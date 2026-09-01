import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BreakRequestReview, openBreakRequestReviewActivity } from './BreakRequestReviewActivity';

const mocks = vi.hoisted(() => ({ launch: vi.fn() }));

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Activity: { launch: mocks.launch },
  ApiProxy: {},
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('../../resources/breakRequests', () => ({
  BreakRequest: class BreakRequest {},
  GlobalBreakRequestTemplate: class GlobalBreakRequestTemplate {},
}));
vi.mock('../common/AnchoredSectionBox', () => ({
  AnchoredSectionBox: () => null,
}));
vi.mock('../common/CapsuleResourceLink', () => ({ CapsuleResourceLink: () => null }));
vi.mock('../subjects/CapsuleSubjectLink', () => ({ CapsuleSubjectLink: () => null }));
vi.mock('./BreakRequestResultingChanges', () => ({
  BreakRequestResultingChanges: () => null,
}));

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { pathname: '/c/main/capsule/break-requests' } },
  });
});

describe('BreakRequest review activity', () => {
  it('opens a temporary review tab on the right', () => {
    openBreakRequestReviewActivity({
      cluster: 'main',
      metadata: { name: 'incident-access', namespace: 'solar-test' },
    });

    expect(mocks.launch).toHaveBeenCalledOnce();
    const activity = mocks.launch.mock.calls[0][0];
    expect(activity).toMatchObject({
      cluster: 'main',
      id: expect.stringContaining('capsule-break-request-review solar-test incident-access'),
      location: 'split-right',
      temporary: true,
      title: 'Review BreakRequest solar-test/incident-access',
    });
    const content = activity.content as ReactElement<any>;
    expect(content.type).toBe(BreakRequestReview);
    expect(content.props).toMatchObject({
      cluster: 'main',
      name: 'incident-access',
      namespace: 'solar-test',
    });
  });
});
