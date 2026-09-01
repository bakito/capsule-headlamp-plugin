import { describe, expect, it } from 'vitest';
import {
  breakRequestReviewDateTimeInput,
  buildBreakRequestReviewRequest,
  hasBreakRequestApprovalSnapshot,
  normalizeBreakRequestReviewStartTime,
} from './breakRequestReview';

function reviewableRequest(withSnapshot = true) {
  return {
    kind: 'BreakRequest',
    metadata: { name: 'incident-access', namespace: 'solar-test' },
    status: {
      ...(withSnapshot ? { approved: { resources: [] } } : {}),
      conditions: [{ type: 'Ready', status: 'True' }],
      phase: 'Requested',
    },
  };
}

describe('BreakRequest review contract', () => {
  it('patches the status subresource without claiming a reviewer identity', () => {
    const request = buildBreakRequestReviewRequest(
      reviewableRequest(),
      'Approved',
      '  Approved for incident 42  '
    );

    expect(request).toEqual({
      body: {
        status: {
          phase: 'Approved',
          review: {
            message: 'Approved for incident 42',
            verdict: 'Approved',
          },
        },
      },
      name: 'incident-access',
      namespace: 'solar-test',
      url: '/apis/capsule.clastix.io/v1beta2/namespaces/solar-test/breakrequests/incident-access/status',
      verdict: 'Approved',
    });
    expect(request?.body.status.review).not.toHaveProperty('reviewer');
  });

  it('blocks approval until the controller publishes its approval snapshot', () => {
    const item = reviewableRequest(false);

    expect(hasBreakRequestApprovalSnapshot(item)).toBe(false);
    expect(buildBreakRequestReviewRequest(item, 'Approved', 'Looks good')).toBeNull();
    expect(
      buildBreakRequestReviewRequest(item, 'Denied', 'Missing rendered resources')
    ).not.toBeNull();
  });

  it('submits reviewer-adjusted lifecycle values without replacing rendered resources', () => {
    const startTimeInput = breakRequestReviewDateTimeInput('2026-09-01T12:30:45Z');
    const request = buildBreakRequestReviewRequest(
      reviewableRequest(),
      'Approved',
      'Adjusted to the incident window',
      { duration: ' 45m ', startTime: startTimeInput }
    );

    expect(request?.body.status.approved).toEqual({
      duration: '45m',
      startTime: '2026-09-01T12:30:45.000Z',
    });
    expect(request?.body.status.approved).not.toHaveProperty('resources');
    expect(normalizeBreakRequestReviewStartTime(startTimeInput)).toBe('2026-09-01T12:30:45.000Z');
  });

  it('uses an explicit zero duration for an unlimited reviewer approval', () => {
    const request = buildBreakRequestReviewRequest(
      reviewableRequest(),
      'Approved',
      'Unlimited until manual expiration',
      { duration: '  ', startTime: breakRequestReviewDateTimeInput('2026-09-01T12:30:45Z') }
    );

    expect(request?.body.status.approved?.duration).toBe('0s');
  });

  it('requires a valid start time only when lifecycle values accompany approval', () => {
    expect(
      buildBreakRequestReviewRequest(reviewableRequest(), 'Approved', 'Looks good', {
        duration: '1h',
        startTime: '',
      })
    ).toBeNull();
    expect(
      buildBreakRequestReviewRequest(reviewableRequest(), 'Denied', 'Not required', {
        duration: '1h',
        startTime: '',
      })?.body.status
    ).not.toHaveProperty('approved');
  });

  it('requires a reviewable request and a non-empty comment', () => {
    expect(buildBreakRequestReviewRequest(reviewableRequest(), 'Approved', '   ')).toBeNull();
    expect(
      buildBreakRequestReviewRequest(
        { ...reviewableRequest(), status: { phase: 'Active', approved: {} } },
        'Denied',
        'Too late'
      )
    ).toBeNull();
  });
});
