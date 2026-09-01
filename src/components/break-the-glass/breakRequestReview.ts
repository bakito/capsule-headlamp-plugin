import { breakRequestIsReviewable } from './breakRequestHelpers';

export type BreakRequestReviewVerdict = 'Approved' | 'Denied';

export interface BreakRequestApprovalInput {
  duration: string;
  startTime: string;
}

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export function hasBreakRequestApprovalSnapshot(item: any): boolean {
  return objectData(item).status?.approved !== undefined;
}

export interface BreakRequestReviewRequest {
  body: {
    status: {
      approved?: {
        duration: string;
        startTime: string;
      };
      phase: BreakRequestReviewVerdict;
      review: {
        message: string;
        verdict: BreakRequestReviewVerdict;
      };
    };
  };
  name: string;
  namespace: string;
  url: string;
  verdict: BreakRequestReviewVerdict;
}

/** Formats an API timestamp for a browser-local datetime input without changing the instant. */
export function breakRequestReviewDateTimeInput(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 19);
}

/** Converts the browser-local review input back to the RFC3339 timestamp expected by Kubernetes. */
export function normalizeBreakRequestReviewStartTime(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Builds the status-subresource transition accepted by the BreakRequest admission webhooks. */
export function buildBreakRequestReviewRequest(
  item: any,
  verdict: BreakRequestReviewVerdict,
  comment: string,
  approval?: BreakRequestApprovalInput
): BreakRequestReviewRequest | null {
  const data = objectData(item);
  const kind = data.kind || item?.kind || item?.constructor?.kind;
  const name = data.metadata?.name || item?.getName?.();
  const namespace = data.metadata?.namespace || item?.getNamespace?.();
  const message = comment.trim();
  const startTime = approval ? normalizeBreakRequestReviewStartTime(approval.startTime) : undefined;

  if (
    (kind && kind !== 'BreakRequest') ||
    !name ||
    !namespace ||
    !message ||
    !breakRequestIsReviewable(item) ||
    (verdict === 'Approved' && !hasBreakRequestApprovalSnapshot(item)) ||
    (verdict === 'Approved' && approval !== undefined && !startTime)
  ) {
    return null;
  }

  const approved =
    verdict === 'Approved' && approval && startTime
      ? {
          // A concrete zero duration prevents template defaults from replacing an intentional
          // unlimited approval when the reviewer clears this field.
          duration: approval.duration.trim() || '0s',
          startTime,
        }
      : undefined;

  return {
    body: {
      status: {
        ...(approved ? { approved } : {}),
        phase: verdict,
        review: {
          message,
          verdict,
        },
      },
    },
    name,
    namespace,
    url: `/apis/capsule.clastix.io/v1beta2/namespaces/${encodeURIComponent(
      namespace
    )}/breakrequests/${encodeURIComponent(name)}/status`,
    verdict,
  };
}
