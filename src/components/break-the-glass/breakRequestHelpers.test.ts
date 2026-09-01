import { describe, expect, it } from 'vitest';
import {
  breakRequestAuditTrail,
  breakRequestIsReviewable,
  breakRequestNamespacesFromSearch,
  breakRequestPhase,
  breakRequestPhaseColor,
  breakRequestPhasePresentation,
  breakRequestReviewRecorded,
  breakRequestServiceAccountEntity,
  breakRequestTemplateDescription,
  breakRequestTemplateIcon,
  combineBreakRequestTemplates,
  flattenRenderedBreakRequestTargets,
  formatAccessEntity,
  templateApprovalMode,
  templateNamespaces,
  templateTargetCount,
} from './breakRequestHelpers';

describe('BreakRequest helpers', () => {
  it('normalizes review readiness and actor labels', () => {
    const request = {
      spec: { requestor: { name: 'alice', type: 'User' } },
      status: {
        phase: 'Requested',
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    };

    expect(breakRequestPhase(request)).toBe('Requested');
    expect(breakRequestIsReviewable(request)).toBe(true);
    expect(formatAccessEntity(request.spec.requestor)).toBe('User/alice');
  });

  it('parses Headlamp plus-separated Namespace filters from the URL', () => {
    expect(
      breakRequestNamespacesFromSearch('?namespace=solar-prod+solar-system+solar-test+solar-uat')
    ).toEqual(['solar-prod', 'solar-system', 'solar-test', 'solar-uat']);
  });

  it('flattens rendered status targets without inventing scope', () => {
    const rows = flattenRenderedBreakRequestTargets({
      status: {
        approved: {
          resources: [
            {
              policy: { creation: 'Owner' },
              targets: [
                {
                  apiVersion: 'rbac.authorization.k8s.io/v1',
                  kind: 'Role',
                  metadata: { name: 'temporary-editor', namespace: 'solar-test' },
                },
              ],
            },
          ],
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      name: 'temporary-editor',
      namespace: 'solar-test',
      policy: { creation: 'Owner' },
    });
  });

  it('builds an ordered audit trail with the authenticated review result', () => {
    const trail = breakRequestAuditTrail({
      metadata: { creationTimestamp: '2026-08-31T10:00:00Z' },
      spec: { reason: 'Incident response', requestor: { name: 'alice', type: 'User' } },
      status: {
        serviceAccount: { name: 'capsule', namespace: 'capsule-system' },
        conditions: [
          {
            type: 'Approved',
            status: 'True',
            lastTransitionTime: '2026-08-31T10:05:00Z',
          },
          {
            type: 'Requested',
            status: 'True',
            message: 'Pending review',
            lastTransitionTime: '2026-08-31T10:01:00Z',
          },
        ],
        review: {
          message: 'Approved for incident 42',
          reviewer: { name: 'bob', type: 'User' },
          verdict: 'Approved',
        },
      },
    });

    expect(trail.map(entry => entry.stage)).toEqual(['Created', 'Requested', 'Approved']);
    expect(trail[1]).toMatchObject({
      actor: 'ServiceAccount/capsule-system/capsule',
      actorEntity: { name: 'capsule-system/capsule', type: 'ServiceAccount' },
    });
    expect(trail[2]).toMatchObject({
      actor: 'User/bob',
      actorEntity: { name: 'bob', type: 'User' },
      message: 'Approved for incident 42',
      verdict: 'Approved',
    });
  });

  it('always orders Active after Approved when their timestamps are equal', () => {
    const trail = breakRequestAuditTrail({
      metadata: { creationTimestamp: '2026-09-01T11:12:29Z' },
      spec: { requestor: { name: 'alice', type: 'User' } },
      status: {
        conditions: [
          {
            type: 'Active',
            status: 'True',
            lastTransitionTime: '2026-09-01T11:15:00Z',
          },
          {
            type: 'Approved',
            status: 'True',
            lastTransitionTime: '2026-09-01T11:15:00Z',
          },
        ],
        review: { verdict: 'Approved' },
      },
    });

    expect(trail.map(entry => entry.stage)).toEqual(['Created', 'Approved', 'Active']);
  });

  it('uses the audit palette for lifecycle phase presentation', () => {
    expect(breakRequestPhasePresentation('Approved')).toMatchObject({
      chipColor: 'success',
      color: '#2e7d32',
    });
    expect(breakRequestPhasePresentation('Active')).toMatchObject({
      chipColor: 'success',
      color: '#00897b',
    });
    expect(breakRequestPhaseColor('Denied')).toBe('error');
  });

  it('retains a status review even when no matching condition reports it', () => {
    const trail = breakRequestAuditTrail({
      metadata: { creationTimestamp: '2026-08-31T10:00:00Z' },
      spec: { requestor: { name: 'alice', type: 'User' } },
      status: {
        review: {
          message: 'Emergency access accepted',
          reviewer: { name: 'bob', type: 'User' },
          verdict: 'Approved',
        },
      },
    });

    expect(trail.map(entry => entry.stage)).toEqual(['Created', 'Approved']);
    expect(trail[1]).toMatchObject({
      actor: 'User/bob',
      message: 'Emergency access accepted',
      verdict: 'Approved',
    });
    expect(trail[1].timestamp).toBeUndefined();
  });

  it('attributes automatic approval to the status-reported controller ServiceAccount', () => {
    const trail = breakRequestAuditTrail({
      spec: { requestor: { name: 'alice', type: 'User' } },
      status: {
        conditions: [{ type: 'Approved', status: 'True' }],
        review: { verdict: 'Approved' },
        serviceAccount: { name: 'capsule', namespace: 'capsule-system' },
      },
    });

    expect(trail[1]).toMatchObject({
      actor: 'ServiceAccount/capsule-system/capsule',
      actorEntity: { name: 'capsule-system/capsule', type: 'ServiceAccount' },
      stage: 'Approved',
    });
  });

  it('distinguishes a completed review from the pending status placeholder', () => {
    expect(breakRequestReviewRecorded({ status: { review: { verdict: 'Pending' } } })).toBe(false);
    expect(
      breakRequestReviewRecorded({
        status: { review: { message: 'Still pending', reviewer: { name: 'bob' } } },
      })
    ).toBe(false);
    expect(breakRequestReviewRecorded({ status: { review: { verdict: 'Denied' } } })).toBe(true);
    expect(
      breakRequestServiceAccountEntity({
        status: { serviceAccount: { namespace: 'solar-prod', name: 'capsule-access' } },
      })
    ).toEqual({ type: 'ServiceAccount', name: 'solar-prod/capsule-access' });
  });
});

describe('GlobalBreakRequestTemplate helpers', () => {
  it('keeps global templates visible when no namespaced templates exist', () => {
    const globalTemplates = [{ metadata: { name: 'clusterrole-distribution' } }];

    expect(combineBreakRequestTemplates([], globalTemplates)).toEqual(globalTemplates);
    expect(
      combineBreakRequestTemplates([{ metadata: { name: 'local' } }], globalTemplates).map(
        template => template.metadata.name
      )
    ).toEqual(['local', 'clusterrole-distribution']);
  });

  it('summarizes approval, targets, and resolved namespaces', () => {
    const template = {
      spec: {
        approvals: { auto: true },
        resources: [{ targets: [{ kind: 'Role' }], template: 'kind: RoleBinding' }],
      },
      status: { namespaces: ['solar-test', 'solar-prod'] },
    };

    expect(templateApprovalMode(template)).toBe('Automatic');
    expect(templateTargetCount(template)).toBe(2);
    expect(templateNamespaces(template)).toEqual(['solar-test', 'solar-prod']);
  });

  it('reads safe catalog presentation annotations', () => {
    const template = {
      metadata: {
        annotations: {
          'info.projectcapsule.dev/description': 'Temporary production diagnostics',
          'info.projectcapsule.dev/icon': 'mdi:shield-search',
        },
      },
    };

    expect(breakRequestTemplateDescription(template)).toBe('Temporary production diagnostics');
    expect(breakRequestTemplateIcon(template)).toBe('mdi:shield-search');
    expect(
      breakRequestTemplateIcon({
        metadata: { annotations: { 'info.projectcapsule.dev/icon': 'javascript:alert(1)' } },
      })
    ).toBeUndefined();
  });
});
