import { describe, expect, it } from 'vitest';
import {
  breakRequestTemplateCategory,
  buildCreateBreakRequest,
  filterBreakRequestTemplates,
  groupBreakRequestTemplates,
  templateAvailableInNamespaces,
  UNCATEGORIZED_TEMPLATE_CATEGORY,
} from './breakRequestCreate';

describe('BreakRequest creation', () => {
  it('builds a namespaced request without supplying an authenticated requestor', () => {
    const request = buildCreateBreakRequest({
      duration: '1h',
      name: 'incident-access',
      namespace: 'solar-test',
      params: { subjectKind: 'User', subjectName: 'alice' },
      reason: 'Incident 42',
      templateName: 'crd-resource-crud',
    });

    expect(request?.url).toBe(
      '/apis/capsule.clastix.io/v1beta2/namespaces/solar-test/breakrequests'
    );
    expect(request?.body.spec).toMatchObject({
      duration: '1h',
      params: { subjectKind: 'User', subjectName: 'alice' },
      reason: 'Incident 42',
      template: { kind: 'GlobalBreakRequestTemplate', name: 'crd-resource-crud' },
    });
    expect(request?.body.spec).not.toHaveProperty('requestor');
  });

  it('uses metadata.generateName when the user requests a generated name', () => {
    const request = buildCreateBreakRequest({
      generateName: 'incident-access',
      namespace: 'solar-test',
      params: {},
      reason: 'Incident 43',
      templateName: 'crd-resource-crud',
    });

    expect(request?.generated).toBe(true);
    expect(request?.body.metadata).toEqual({
      generateName: 'incident-access-',
      namespace: 'solar-test',
    });
    expect(request?.body.metadata).not.toHaveProperty('name');
  });

  it('references a namespaced BreakRequestTemplate when selected', () => {
    const request = buildCreateBreakRequest({
      name: 'local-template-access',
      namespace: 'solar-test',
      params: {},
      templateKind: 'BreakRequestTemplate',
      templateName: 'namespace-editor',
    });

    expect(request?.body.spec.template).toEqual({
      kind: 'BreakRequestTemplate',
      name: 'namespace-editor',
    });
  });

  it('preserves a root array as raw JSON Schema form data', () => {
    const request = buildCreateBreakRequest({
      name: 'multi-role-access',
      namespace: 'solar-test',
      params: ['view', 'edit'],
      templateName: 'clusterrole-distribution',
    });

    expect(request?.body.spec.params).toEqual(['view', 'edit']);
  });

  it('filters templates against their controller-reported Namespace availability', () => {
    expect(templateAvailableInNamespaces({ status: { namespaces: ['*'] } }, ['solar-test'])).toBe(
      true
    );
    expect(
      templateAvailableInNamespaces({ status: { namespaces: ['solar-prod'] } }, ['solar-test'])
    ).toBe(false);
  });

  it('searches templates and applies every selected tag', () => {
    const templates = [
      {
        getName: () => 'production-diagnostics',
        metadata: {
          annotations: {
            'info.projectcapsule.dev/description': 'Temporary incident access',
            'info.projectcapsule.dev/tags': 'production, diagnostics, break-glass',
          },
        },
      },
      {
        getName: () => 'production-readonly',
        metadata: {
          annotations: {
            'info.projectcapsule.dev/description': 'Read-only access',
            'info.projectcapsule.dev/tags': 'production, readonly',
          },
        },
      },
    ];

    expect(filterBreakRequestTemplates(templates, 'incident', [])).toEqual([templates[0]]);
    expect(filterBreakRequestTemplates(templates, '', ['production', 'diagnostics'])).toEqual([
      templates[0],
    ]);
    expect(filterBreakRequestTemplates(templates, '', ['diagnostics', 'readonly'])).toEqual([]);
  });

  it('groups templates once by their first tag and puts untagged templates last', () => {
    const templates = [
      {
        getName: () => 'untagged',
        metadata: { annotations: {} },
      },
      {
        getName: () => 'production-readonly',
        metadata: { annotations: { 'info.projectcapsule.dev/tags': 'production, readonly' } },
      },
      {
        getName: () => 'development-admin',
        metadata: { annotations: { 'info.projectcapsule.dev/tags': 'development, admin' } },
      },
    ];

    expect(breakRequestTemplateCategory(templates[1])).toBe('production');
    expect(breakRequestTemplateCategory(templates[0])).toBe(UNCATEGORIZED_TEMPLATE_CATEGORY);
    expect(
      groupBreakRequestTemplates(templates).map(group => [
        group.category,
        group.templates.map(template => template.getName()),
      ])
    ).toEqual([
      ['development', ['development-admin']],
      ['production', ['production-readonly']],
      [UNCATEGORIZED_TEMPLATE_CATEGORY, ['untagged']],
    ]);
  });
});
