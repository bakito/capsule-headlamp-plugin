import { isResourceReady } from '../../resources/tenantResources.helpers';
import { usagePercent, usageSeverity } from '../../utils/quantity';

export interface ReadinessStats {
  ready: number;
  notReady: number;
  total: number;
}

export interface QuotaHealthStats {
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

export interface ResourcePoolStats extends ReadinessStats {
  claims: number;
  exhausted: number;
}

export interface ResourcePermitCatalogStats {
  active: number;
  approved: number;
  created: number;
  denied: number;
  expired: number;
  failed: number;
  pending: number;
  requested: number;
  retrying: number;
  reviewable: number;
  total: number;
}

function objectData(item: any) {
  return item?.jsonData || item || {};
}

export function countResourcePermitCatalog(
  items: any[] | null | undefined
): ResourcePermitCatalogStats {
  const stats: ResourcePermitCatalogStats = {
    active: 0,
    approved: 0,
    created: 0,
    denied: 0,
    expired: 0,
    failed: 0,
    pending: 0,
    requested: 0,
    retrying: 0,
    reviewable: 0,
    total: (items || []).length,
  };

  for (const item of items || []) {
    const data = objectData(item);
    const phase = String(
      data.status?.phase || ''
    ).toLowerCase() as keyof ResourcePermitCatalogStats;
    if (phase in stats && phase !== 'total' && phase !== 'reviewable') stats[phase] += 1;

    const ready = (data.status?.conditions || []).some(
      (condition: any) =>
        condition?.type === 'Ready' && String(condition.status).toLowerCase() === 'true'
    );
    if ((phase === 'requested' || phase === 'pending') && ready) stats.reviewable += 1;
  }

  return stats;
}

export function countReadiness(items: any[] | null | undefined): ReadinessStats {
  const list = items || [];
  const ready = list.filter(item => isResourceReady(item)).length;
  return { ready, notReady: list.length - ready, total: list.length };
}

export function countQuotaHealth(items: any[] | null | undefined): QuotaHealthStats {
  let healthy = 0;
  let warning = 0;
  let critical = 0;

  (items || []).forEach(item => {
    const spec = item?.spec || item?.jsonData?.spec;
    const status = item?.status || item?.jsonData?.status;
    const percentage = usagePercent(status?.usage?.used, spec?.limit);
    const severity = usageSeverity(percentage);
    if (severity === 'critical') critical++;
    else if (severity === 'warning') warning++;
    else healthy++;
  });

  return { healthy, warning, critical, total: (items || []).length };
}

export function countResourcePools(items: any[] | null | undefined): ResourcePoolStats {
  const readiness = countReadiness(items);
  let claims = 0;
  let exhausted = 0;

  (items || []).forEach(item => {
    const status = item?.status || item?.jsonData?.status || {};
    claims += Number(status.claimCount) || 0;
    if (
      (status.conditions || []).some(
        (condition: any) =>
          condition?.type === 'Exhausted' &&
          (condition.status === 'True' || condition.status === true)
      )
    ) {
      exhausted++;
    }
  });

  return { ...readiness, claims, exhausted };
}
