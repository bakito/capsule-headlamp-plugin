import { describe, expect, it } from 'vitest';
import { buildBreakRequestExpireRequest, canExpireBreakRequest } from './breakRequestExpire';

describe('BreakRequest expiry contract', () => {
  it('builds the terminal status-subresource transition', () => {
    const request = buildBreakRequestExpireRequest({
      kind: 'BreakRequest',
      metadata: { name: 'incident access', namespace: 'solar-test' },
      status: { phase: 'Active' },
    });

    expect(request).toEqual({
      body: { status: { phase: 'Expired' } },
      name: 'incident access',
      namespace: 'solar-test',
      resourceUrl:
        '/apis/capsule.clastix.io/v1beta2/namespaces/solar-test/breakrequests/incident%20access',
      url: '/apis/capsule.clastix.io/v1beta2/namespaces/solar-test/breakrequests/incident%20access/status',
    });
  });

  it('allows every reported non-terminal phase and hides the action afterward', () => {
    for (const phase of ['Requested', 'Pending', 'Denied', 'Approved', 'Active']) {
      expect(canExpireBreakRequest({ status: { phase } })).toBe(true);
    }
    expect(canExpireBreakRequest({ status: { phase: 'Expired' } })).toBe(false);
    expect(canExpireBreakRequest({ status: {} })).toBe(false);
  });
});
