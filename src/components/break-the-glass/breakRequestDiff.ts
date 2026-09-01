import { type Change, diffLines } from 'diff';
import { getPlural } from '../../resources/tenantResources.helpers';
import type { RenderedBreakRequestTarget } from './breakRequestHelpers';

export function breakRequestTargetDiscoveryURL(target: RenderedBreakRequestTarget): string {
  return target.apiVersion === 'v1' || !target.apiVersion.includes('/')
    ? '/api/v1'
    : `/apis/${target.apiVersion}`;
}

export function breakRequestTargetURL(
  target: RenderedBreakRequestTarget,
  discoveredResourceName?: string
): string {
  const prefix = breakRequestTargetDiscoveryURL(target);
  const namespace = target.namespace ? `/namespaces/${encodeURIComponent(target.namespace)}` : '';
  const resourceName = discoveredResourceName || getPlural(target.kind);
  return `${prefix}${namespace}/${encodeURIComponent(resourceName)}/${encodeURIComponent(
    target.name
  )}`;
}

function projectLiveValue(live: any, desired: any): any {
  if (Array.isArray(desired)) return Array.isArray(live) ? live : undefined;
  if (!desired || typeof desired !== 'object') return live;

  return Object.fromEntries(
    Object.entries(desired).map(([key, value]) => [key, projectLiveValue(live?.[key], value)])
  );
}

/** Compares only manifest-owned fields so server metadata/status are not shown as deletions. */
export function breakRequestTargetDiff(live: any | undefined, desired: any): Change[] {
  const current = live === undefined ? {} : projectLiveValue(live, desired);
  return diffLines(JSON.stringify(current, null, 2), JSON.stringify(desired, null, 2));
}

export function isKubernetesNotFound(error: any): boolean {
  return (
    error?.status === 404 ||
    error?.statusCode === 404 ||
    error?.response?.status === 404 ||
    /\b404\b|not found/i.test(String(error?.message || error || ''))
  );
}
