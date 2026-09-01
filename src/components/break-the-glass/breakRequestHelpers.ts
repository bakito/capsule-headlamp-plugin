import type {
  BreakRequestAccessEntity,
  BreakRequestPhase,
  BreakRequestRenderedResource,
  BreakRequestVerdict,
  GlobalBreakRequestTemplateResource,
} from '../../resources/breakRequests';
import { normalizeIconRef } from '../../utils/tenantMeta';

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export type BreakRequestPhaseColor = 'error' | 'info' | 'success' | 'warning';

export interface BreakRequestPhasePresentation {
  chipColor: BreakRequestPhaseColor;
  color: string;
  icon: string;
}

export function breakRequestPhase(item: any): BreakRequestPhase | 'Unknown' {
  return objectData(item).status?.phase || 'Unknown';
}

export function breakRequestPhaseColor(phase: string): BreakRequestPhaseColor {
  return breakRequestPhasePresentation(phase).chipColor;
}

/** Shared lifecycle presentation for phase chips, summaries, and the audit timeline. */
export function breakRequestPhasePresentation(phase: string): BreakRequestPhasePresentation {
  switch (phase.toLowerCase()) {
    case 'created':
      return {
        chipColor: 'info',
        color: '#1976d2',
        icon: 'mdi:file-document-plus-outline',
      };
    case 'active':
      return { chipColor: 'success', color: '#00897b', icon: 'mdi:key-variant' };
    case 'denied':
      return { chipColor: 'error', color: '#d32f2f', icon: 'mdi:close-thick' };
    case 'expired':
      return { chipColor: 'info', color: '#546e7a', icon: 'mdi:timer-off-outline' };
    case 'approved':
      return { chipColor: 'success', color: '#2e7d32', icon: 'mdi:check-bold' };
    case 'requested':
    case 'pending':
      return { chipColor: 'warning', color: '#ed6c02', icon: 'mdi:clock-outline' };
    default:
      return { chipColor: 'info', color: '#7b1fa2', icon: 'mdi:circle-medium' };
  }
}

export function formatAccessEntity(entity?: BreakRequestAccessEntity): string {
  if (!entity?.name) return 'Unknown';
  return entity.type ? `${entity.type}/${entity.name}` : entity.name;
}

/** The concrete ServiceAccount Capsule reports as the request execution identity. */
export function breakRequestServiceAccountEntity(item: any): BreakRequestAccessEntity | undefined {
  const serviceAccount = objectData(item).status?.serviceAccount;
  const name = String(serviceAccount?.name || '').trim();
  const namespace = String(serviceAccount?.namespace || '').trim();
  if (!name) return undefined;

  const qualifiedName =
    namespace && !name.includes('/') && !name.startsWith('system:serviceaccount:')
      ? `${namespace}/${name}`
      : name;
  return { type: 'ServiceAccount', name: qualifiedName };
}

/** Pending review placeholders are not completed verdicts. */
export function breakRequestReviewRecorded(item: any): boolean {
  const review = objectData(item).status?.review;
  const verdict = String(review?.verdict || '').toLowerCase();
  return verdict === 'approved' || verdict === 'denied';
}

export function breakRequestReady(item: any): boolean {
  const conditions = objectData(item).status?.conditions || [];
  return conditions.some(
    (condition: any) =>
      condition?.type === 'Ready' && String(condition.status).toLowerCase() === 'true'
  );
}

export function breakRequestIsReviewable(item: any): boolean {
  const phase = breakRequestPhase(item);
  return (phase === 'Requested' || phase === 'Pending') && breakRequestReady(item);
}

/** Headlamp serializes its Namespace filter as a space-delimited query value. */
export function breakRequestNamespacesFromSearch(search: string): string[] {
  const value = new URLSearchParams(search).get('namespace') || '';
  return [
    ...new Set(
      value
        .split(/\s+/)
        .map(namespace => namespace.trim())
        .filter(Boolean)
    ),
  ];
}

export interface RenderedBreakRequestTarget {
  apiVersion: string;
  id: string;
  kind: string;
  manifest: Record<string, any>;
  name: string;
  namespace?: string;
  policy: Record<string, any>;
  resourceIndex: number;
  targetIndex: number;
}

export function flattenRenderedBreakRequestTargets(item: any): RenderedBreakRequestTarget[] {
  const status = objectData(item).status;
  const resources: BreakRequestRenderedResource[] =
    status?.approved?.resources || status?.resources || [];
  return resources.flatMap((resource, resourceIndex) =>
    (resource.targets || []).map((target, targetIndex) => ({
      apiVersion: target.apiVersion || 'v1',
      id: `${resourceIndex}-${targetIndex}-${target.kind || 'Resource'}-${
        target.metadata?.namespace || '-'
      }-${target.metadata?.name || targetIndex}`,
      kind: target.kind || 'Resource',
      manifest: target,
      name: target.metadata?.name || 'Unnamed',
      namespace: target.metadata?.namespace,
      policy: resource.policy || {},
      resourceIndex,
      targetIndex,
    }))
  );
}

export interface BreakRequestAuditEntry {
  actor: string;
  actorEntity?: BreakRequestAccessEntity;
  message: string;
  stage: string;
  timestamp?: string;
  verdict?: BreakRequestVerdict;
}

export function breakRequestAuditTrail(item: any): BreakRequestAuditEntry[] {
  const data = objectData(item);
  const review = data.status?.review;
  const controllerEntity = breakRequestServiceAccountEntity(data);
  const controllerActor = controllerEntity
    ? formatAccessEntity(controllerEntity)
    : 'Capsule controller';
  let reviewRecorded = false;
  const entries: BreakRequestAuditEntry[] = [
    {
      actor: formatAccessEntity(data.spec?.requestor),
      actorEntity: data.spec?.requestor,
      message: data.spec?.reason || 'BreakRequest created',
      stage: 'Created',
      timestamp: data.metadata?.creationTimestamp,
    },
  ];

  for (const condition of data.status?.conditions || []) {
    if (condition.type === 'Ready') continue;
    const isReview = condition.type === 'Approved' || condition.type === 'Denied';
    const reviewEntity = review?.reviewer?.name ? review.reviewer : controllerEntity;
    if (isReview) reviewRecorded = true;
    entries.push({
      actor: isReview ? formatAccessEntity(reviewEntity) : controllerActor,
      actorEntity: isReview ? reviewEntity : controllerEntity,
      message:
        (isReview && review?.message) || condition.message || condition.reason || condition.type,
      stage: condition.type,
      timestamp: condition.lastTransitionTime,
      verdict: isReview
        ? review?.verdict && review.verdict !== 'Pending'
          ? review.verdict
          : (condition.type as BreakRequestVerdict)
        : undefined,
    });
  }

  if (review && !reviewRecorded && breakRequestReviewRecorded(data)) {
    const reviewEntity = review.reviewer?.name ? review.reviewer : controllerEntity;
    entries.push({
      actor: formatAccessEntity(reviewEntity),
      actorEntity: reviewEntity,
      message: review.message || `Review verdict: ${review.verdict || 'Recorded'}`,
      stage: review.verdict && review.verdict !== 'Pending' ? review.verdict : 'Reviewed',
      verdict: review.verdict,
    });
  }

  const stageOrder = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'created':
        return 0;
      case 'requested':
      case 'pending':
        return 10;
      case 'approved':
      case 'denied':
      case 'reviewed':
        return 20;
      case 'active':
        return 30;
      case 'expired':
        return 40;
      default:
        return 25;
    }
  };

  return entries.sort((left, right) => {
    if (!left.timestamp && !right.timestamp) return 0;
    if (!left.timestamp) return left.stage === 'Created' ? -1 : 1;
    if (!right.timestamp) return right.stage === 'Created' ? 1 : -1;
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    return leftTime - rightTime || stageOrder(left.stage) - stageOrder(right.stage);
  });
}

export function templateApprovalMode(item: any): 'Automatic' | 'Manual' {
  return objectData(item).spec?.approvals?.auto ? 'Automatic' : 'Manual';
}

export function templateTargetCount(item: any): number {
  const resources: GlobalBreakRequestTemplateResource[] = objectData(item).spec?.resources || [];
  return resources.reduce(
    (count, resource) => count + (resource.targets?.length || 0) + (resource.template ? 1 : 0),
    0
  );
}

export function templateNamespaces(item: any): string[] {
  const namespaces = objectData(item).status?.namespaces;
  return Array.isArray(namespaces) ? namespaces : [];
}

/** One catalog inventory can contain both local and cluster-scoped templates. */
export function combineBreakRequestTemplates<TNamespaced, TGlobal>(
  namespaced: TNamespaced[] | null | undefined,
  global: TGlobal[] | null | undefined
): Array<TNamespaced | TGlobal> {
  return [...(namespaced || []), ...(global || [])];
}

function templateAnnotations(item: any): Record<string, string> {
  return objectData(item).metadata?.annotations || {};
}

/** Optional catalog description shared by template lists, details, and creation. */
export function breakRequestTemplateDescription(item: any): string | undefined {
  const description = templateAnnotations(item)['info.projectcapsule.dev/description'];
  return typeof description === 'string' && description.trim() ? description.trim() : undefined;
}

/** Safe Iconify, Font Awesome, or image reference from the conventional info annotation. */
export function breakRequestTemplateIcon(item: any): string | undefined {
  return normalizeIconRef(templateAnnotations(item)['info.projectcapsule.dev/icon']);
}
