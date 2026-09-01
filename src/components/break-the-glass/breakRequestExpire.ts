import { breakRequestPhase } from './breakRequestHelpers';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export function canExpireBreakRequest(item: any): boolean {
  const phase = breakRequestPhase(item);
  return phase !== 'Unknown' && phase !== 'Expired';
}

export interface BreakRequestExpireRequest {
  body: {
    status: {
      phase: 'Expired';
    };
  };
  name: string;
  namespace: string;
  resourceUrl: string;
  url: string;
}

/** Requests the terminal lifecycle transition without reconstructing controller-owned status. */
export function buildBreakRequestExpireRequest(item: any): BreakRequestExpireRequest | null {
  const data = objectData(item);
  const kind = data.kind || item?.kind || item?.constructor?.kind;
  const name = data.metadata?.name || item?.getName?.();
  const namespace = data.metadata?.namespace || item?.getNamespace?.();
  if ((kind && kind !== 'BreakRequest') || !name || !namespace || !canExpireBreakRequest(item)) {
    return null;
  }

  const resourceUrl = `/apis/capsule.clastix.io/v1beta2/namespaces/${encodeURIComponent(
    namespace
  )}/breakrequests/${encodeURIComponent(name)}`;
  return {
    body: { status: { phase: 'Expired' } },
    name,
    namespace,
    resourceUrl,
    url: `${resourceUrl}/status`,
  };
}

export function replaceBreakRequestData(item: any, response: any) {
  if (!item) return;
  const refreshed = response?.jsonData || response;
  if (!refreshed) return;
  if (item.jsonData) item.jsonData = refreshed;
  else Object.assign(item, refreshed);
}
