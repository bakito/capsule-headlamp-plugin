import { describe, expect, it } from 'vitest';
import {
  breakRequestDefaultParamData,
  breakRequestParamSchema2020,
  buildBreakRequestUiSchema,
  discoverCapsuleFormExtensions,
  JSON_SCHEMA_2020_12,
  resolveLocalSchemaRef,
  validateBreakRequestParamData,
} from './breakRequestJsonSchema';

const selector = (kind: string, apiVersion = 'v1', namespace?: string) => ({
  widget: 'kubernetes-resource',
  source: { apiVersion, kind, ...(namespace ? { namespace } : {}) },
});

describe('BreakRequest JSON Schema 2020-12 form', () => {
  it('maps a scalar Secret selector to a single-value RJSF widget', () => {
    const schema = {
      type: 'object',
      properties: {
        secret: { type: 'string', 'x-capsule-form': selector('Secret') },
      },
    };

    expect(buildBreakRequestUiSchema(schema).secret).toMatchObject({
      'ui:widget': 'kubernetes-resource',
      'ui:options': { capsuleForm: selector('Secret'), capsuleMultiple: false },
    });
    expect(
      buildBreakRequestUiSchema({
        type: 'string',
        'x-capsule-form': selector('Secret'),
      })
    ).toMatchObject({
      'ui:widget': 'kubernetes-resource',
      'ui:options': { capsuleMultiple: false },
    });
  });

  it('maps a ClusterRole selector under array items to one string-array widget', () => {
    const schema = {
      type: 'object',
      required: ['clusterRoles'],
      properties: {
        clusterRoles: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            type: 'string',
            'x-capsule-form': selector('ClusterRole', 'rbac.authorization.k8s.io/v1'),
          },
        },
      },
    };

    expect(buildBreakRequestUiSchema(schema).clusterRoles).toMatchObject({
      'ui:widget': 'kubernetes-resource',
      'ui:options': { capsuleMultiple: true },
    });
    expect(
      validateBreakRequestParamData(schema, { clusterRoles: ['view', 'edit'] }).errors
    ).toEqual([]);
  });

  it('supports a Namespace selector under array items', () => {
    const schema = {
      type: 'object',
      properties: {
        namespaces: {
          type: 'array',
          items: {
            type: 'string',
            'x-capsule-form': selector('Namespace'),
          },
        },
      },
    };

    expect(
      (buildBreakRequestUiSchema(schema).namespaces as any)['ui:options'].capsuleForm.source
    ).toEqual({ apiVersion: 'v1', kind: 'Namespace' });
    expect(
      (buildBreakRequestUiSchema(schema).namespaces as any)['ui:options'].capsuleMultiple
    ).toBe(true);
  });

  it('resolves selectors through $defs/$ref and stops local-reference loops', () => {
    const schema = {
      type: 'object',
      $defs: {
        roleList: {
          type: 'array',
          items: {
            type: 'string',
            'x-capsule-form': selector('ClusterRole', 'rbac.authorization.k8s.io/v1'),
          },
        },
        recursive: { $ref: '#/$defs/recursive' },
      },
      properties: {
        roles: { $ref: '#/$defs/roleList' },
        recursive: { $ref: '#/$defs/recursive' },
      },
    };

    expect(resolveLocalSchemaRef(schema, '#/$defs/roleList')).toBe(schema.$defs.roleList);
    expect(buildBreakRequestUiSchema(schema).roles).toMatchObject({
      'ui:widget': 'kubernetes-resource',
      'ui:options': { capsuleMultiple: true },
    });
    expect(() => discoverCapsuleFormExtensions(schema)).not.toThrow();
  });

  it('retains selectors through nested arrays and objects', () => {
    const schema = {
      type: 'object',
      properties: {
        environments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              namespaces: {
                type: 'array',
                items: {
                  type: 'string',
                  'x-capsule-form': selector('Namespace'),
                },
              },
            },
          },
        },
      },
    };

    expect((buildBreakRequestUiSchema(schema) as any).environments.items.namespaces).toMatchObject({
      'ui:widget': 'kubernetes-resource',
      'ui:options': { capsuleMultiple: true },
    });
  });

  it('discovers extensions across JSON Schema 2020-12 containment keywords', () => {
    const extensionSchema = { type: 'string', 'x-capsule-form': selector('Secret') };
    const schema = {
      type: 'object',
      properties: { direct: extensionSchema },
      items: extensionSchema,
      prefixItems: [extensionSchema],
      additionalProperties: extensionSchema,
      $defs: { selector: extensionSchema },
      definitions: { selector: extensionSchema },
      allOf: [extensionSchema],
      anyOf: [extensionSchema],
      oneOf: [extensionSchema],
      not: extensionSchema,
      if: extensionSchema,
      then: extensionSchema,
      else: extensionSchema,
      contains: extensionSchema,
      contentSchema: extensionSchema,
      propertyNames: extensionSchema,
      unevaluatedItems: extensionSchema,
      unevaluatedProperties: extensionSchema,
      dependentSchemas: { mode: extensionSchema },
      patternProperties: { '^x-': extensionSchema },
    };
    const pathRoots = new Set(
      discoverCapsuleFormExtensions(schema).map(result => String(result.schemaPath[0]))
    );

    expect(pathRoots).toEqual(
      new Set([
        'properties',
        'items',
        'prefixItems',
        'additionalProperties',
        '$defs',
        'definitions',
        'allOf',
        'anyOf',
        'oneOf',
        'not',
        'if',
        'then',
        'else',
        'contains',
        'contentSchema',
        'propertyNames',
        'unevaluatedItems',
        'unevaluatedProperties',
        'dependentSchemas',
        'patternProperties',
      ])
    );
  });

  it('preserves defaults, combinators, and opaque Kubernetes validation rules', () => {
    const schema = {
      type: 'object',
      required: ['mode'],
      properties: {
        mode: { type: 'string', default: 'read', enum: ['read', 'write'] },
      },
      allOf: [{ properties: { enabled: { type: 'boolean', default: true } } }],
      'x-kubernetes-validations': [{ rule: 'self.mode != "forbidden"' }],
    };
    const normalized = breakRequestParamSchema2020(schema);

    expect(normalized.$schema).toBe(JSON_SCHEMA_2020_12);
    expect(normalized['x-kubernetes-validations']).toEqual(schema['x-kubernetes-validations']);
    expect(breakRequestDefaultParamData(normalized)).toMatchObject({ mode: 'read', enabled: true });
    expect(validateBreakRequestParamData(schema, { mode: 'read' }).errors).toEqual([]);
  });

  it('validates oneOf, anyOf, and allOf without flattening their branches', () => {
    const schema = {
      type: 'object',
      allOf: [{ required: ['identity'] }],
      properties: {
        identity: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['user'],
              properties: { user: { type: 'string' } },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['group'],
              properties: { group: { type: 'string' } },
            },
          ],
        },
        target: { anyOf: [{ type: 'string' }, { type: 'integer' }] },
      },
    };

    expect(
      validateBreakRequestParamData(schema, { identity: { user: 'alice' }, target: 3 }).errors
    ).toEqual([]);
    expect(
      validateBreakRequestParamData(schema, {
        identity: { user: 'alice', group: 'developers' },
        target: false,
      }).errors.length
    ).toBeGreaterThan(0);
  });

  it('enforces required, minItems, and uniqueItems through Ajv 2020', () => {
    const schema = {
      type: 'object',
      required: ['roles'],
      properties: {
        roles: { type: 'array', minItems: 2, uniqueItems: true, items: { type: 'string' } },
      },
    };

    expect(validateBreakRequestParamData(schema, {}).errors.map(error => error.name)).toContain(
      'required'
    );
    expect(
      validateBreakRequestParamData(schema, { roles: ['view'] }).errors.map(error => error.name)
    ).toContain('minItems');
    expect(
      validateBreakRequestParamData(schema, { roles: ['view', 'view'] }).errors.map(
        error => error.name
      )
    ).toContain('uniqueItems');
  });
});
