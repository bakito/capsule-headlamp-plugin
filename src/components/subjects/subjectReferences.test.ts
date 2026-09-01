import { describe, expect, it } from 'vitest';
import {
  bindingMentionsSubject,
  breakRequestSubjectMentions,
  capsuleSubjectFromServiceAccountReference,
  capsuleSubjectLabel,
  globalProxySettingsSubjectMentions,
  manifestSubjects,
  normalizeCapsuleSubject,
  tenantOwnerMentionsSubject,
  tenantSubjectMentions,
} from './subjectReferences';

describe('Capsule subject references', () => {
  it('canonicalizes Kubernetes ServiceAccount identities', () => {
    const canonical = normalizeCapsuleSubject({
      kind: 'User',
      name: 'system:serviceaccount:solar-prod:deployer',
    });

    expect(canonical).toEqual({
      kind: 'ServiceAccount',
      name: 'deployer',
      namespace: 'solar-prod',
    });
    expect(capsuleSubjectLabel(canonical!)).toBe('ServiceAccount/solar-prod/deployer');
    expect(
      normalizeCapsuleSubject({ kind: 'ServiceAccount', name: 'solar-prod/deployer' })
    ).toEqual(canonical);
    expect(capsuleSubjectFromServiceAccountReference({ name: 'deployer' }, 'solar-prod')).toEqual(
      canonical
    );
  });

  it('finds owner and promotion mentions in a Tenant', () => {
    const tenant = {
      spec: { owners: [{ kind: 'User', name: 'alice' }] },
      status: {
        promotions: [{ kind: 'ServiceAccount', name: 'solar-prod/deployer' }],
      },
    };

    expect(tenantSubjectMentions(tenant, { kind: 'User', name: 'alice' })).toEqual(['Owner']);
    expect(
      tenantSubjectMentions(tenant, {
        kind: 'ServiceAccount',
        name: 'deployer',
        namespace: 'solar-prod',
      })
    ).toEqual(['Promoted identity']);
  });

  it('matches a TenantOwner by its exact normalized identity', () => {
    const owner = { spec: { kind: 'User', name: 'alice' } };

    expect(tenantOwnerMentionsSubject(owner, { kind: 'User', name: 'alice' })).toBe(true);
    expect(tenantOwnerMentionsSubject(owner, { kind: 'Group', name: 'alice' })).toBe(false);
  });

  it('matches native RBAC subjects without conflating ServiceAccount namespaces', () => {
    const binding = {
      subjects: [{ kind: 'ServiceAccount', namespace: 'solar-prod', name: 'deployer' }],
    };

    expect(
      bindingMentionsSubject(binding, {
        kind: 'ServiceAccount',
        namespace: 'solar-prod',
        name: 'deployer',
      })
    ).toBe(true);
    expect(
      bindingMentionsSubject(binding, {
        kind: 'ServiceAccount',
        namespace: 'solar-test',
        name: 'deployer',
      })
    ).toBe(false);
  });

  it('extracts and deduplicates subjects from rendered manifests', () => {
    expect(
      manifestSubjects({
        kind: 'RoleBinding',
        subjects: [
          { kind: 'User', name: 'alice' },
          { kind: 'User', name: 'alice' },
          { kind: 'ServiceAccount', namespace: 'solar-prod', name: 'deployer' },
        ],
      })
    ).toEqual([
      { kind: 'User', name: 'alice' },
      { kind: 'ServiceAccount', namespace: 'solar-prod', name: 'deployer' },
    ]);
  });

  it('finds requestor, group, reviewer, issued identity, and rendered RBAC mentions', () => {
    const request = {
      spec: { requestor: { groups: ['operators'], name: 'alice', type: 'User' } },
      status: {
        review: { reviewer: { name: 'bob', type: 'User' } },
        serviceAccount: { namespace: 'solar-prod', name: 'temporary-access' },
        approved: {
          resources: [
            {
              targets: [
                {
                  kind: 'RoleBinding',
                  subjects: [{ kind: 'User', name: 'alice' }],
                },
              ],
            },
          ],
        },
      },
    };

    expect(breakRequestSubjectMentions(request, { kind: 'User', name: 'alice' })).toEqual([
      'Requestor',
      'Rendered RoleBinding subject',
    ]);
    expect(breakRequestSubjectMentions(request, { kind: 'Group', name: 'operators' })).toEqual([
      'Requestor',
    ]);
    expect(breakRequestSubjectMentions(request, { kind: 'User', name: 'bob' })).toEqual([
      'Reviewer',
    ]);
    expect(
      breakRequestSubjectMentions(request, {
        kind: 'ServiceAccount',
        namespace: 'solar-prod',
        name: 'temporary-access',
      })
    ).toEqual(['Execution ServiceAccount']);
  });

  it('finds every GlobalProxySettings rule mentioning the normalized subject', () => {
    const settings = {
      spec: {
        rules: [
          {
            subjects: [{ kind: 'User', name: 'alice' }],
            clusterResources: [{ apiGroups: [''], resources: ['nodes'] }],
          },
          {
            subjects: [
              {
                kind: 'ServiceAccount',
                name: 'system:serviceaccount:solar-prod:deployer',
              },
            ],
          },
          { subjects: [{ kind: 'User', name: 'alice' }] },
        ],
      },
    };

    expect(globalProxySettingsSubjectMentions(settings, { kind: 'User', name: 'alice' })).toEqual([
      'Rule #1',
      'Rule #3',
    ]);
    expect(
      globalProxySettingsSubjectMentions(settings, {
        kind: 'ServiceAccount',
        namespace: 'solar-prod',
        name: 'deployer',
      })
    ).toEqual(['Rule #2']);
  });
});
