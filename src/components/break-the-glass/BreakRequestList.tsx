import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Alert, Box, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { BreakRequest } from '../../resources/breakRequests';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import { CapsuleSubjectLink } from '../subjects/CapsuleSubjectLink';
import { capsuleSubjectFromAccessEntity } from '../subjects/subjectReferences';
import { canExpireBreakRequest } from './breakRequestExpire';
import { BreakRequestExpireButton } from './BreakRequestExpireAction';
import {
  breakRequestIsReviewable,
  breakRequestNamespacesFromSearch,
  breakRequestPhase,
  breakRequestPhasePresentation,
  formatAccessEntity,
} from './breakRequestHelpers';
import { BreakRequestPhaseChip } from './BreakRequestPhaseChip';
import { BreakRequestReviewButton } from './BreakRequestReviewActivity';
import { NewBreakRequestButton } from './CreateBreakRequestActivity';

export function BreakRequestsList() {
  const location = useLocation();
  const namespaces = useMemo(
    () => breakRequestNamespacesFromSearch(location.search),
    [location.search]
  );
  const [items, error] = BreakRequest.useList({
    namespace: namespaces.length > 0 ? namespaces : undefined,
  });
  const summary = useMemo(() => {
    const result = {
      active: 0,
      approved: 0,
      denied: 0,
      expired: 0,
      managedItems: 0,
      pending: 0,
      requested: 0,
      reviewable: 0,
      total: items?.length || 0,
    };

    for (const item of items || []) {
      const phase = breakRequestPhase(item).toLowerCase() as keyof typeof result;
      if (phase in result && typeof result[phase] === 'number') result[phase] += 1;
      if (breakRequestIsReviewable(item)) result.reviewable += 1;
      result.managedItems += item.status?.size || item.status?.processedItems?.length || 0;
    }

    return result;
  }, [items]);

  if (error) {
    return (
      <SectionBox title="Break Requests">
        <Alert severity="error">
          BreakRequests are unavailable. This page reads the BreakRequest API directly; grant this
          account list access in the selected Namespace scope.
        </Alert>
      </SectionBox>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 0, sm: 2 }, pt: 3 }}>
        <NewBreakRequestButton namespaces={namespaces} />
      </Box>
      <SummaryCardGrid columns={3} marginBottom={2} inset>
        <StatCard
          label="REQUEST PHASES"
          total={summary.total}
          segments={[
            {
              name: 'Requested',
              value: summary.requested,
              color: breakRequestPhasePresentation('Requested').color,
            },
            {
              name: 'Pending',
              value: summary.pending,
              color: breakRequestPhasePresentation('Pending').color,
            },
            {
              name: 'Approved',
              value: summary.approved,
              color: breakRequestPhasePresentation('Approved').color,
            },
            {
              name: 'Active',
              value: summary.active,
              color: breakRequestPhasePresentation('Active').color,
            },
            {
              name: 'Denied',
              value: summary.denied,
              color: breakRequestPhasePresentation('Denied').color,
            },
            {
              name: 'Expired',
              value: summary.expired,
              color: breakRequestPhasePresentation('Expired').color,
            },
          ]}
          chips={[
            { label: `${summary.requested} Requested`, color: 'warning' },
            { label: `${summary.pending} Pending`, color: 'warning' },
            { label: `${summary.approved} Approved`, color: 'success' },
            { label: `${summary.active} Active`, color: 'success' },
            { label: `${summary.denied} Denied`, color: 'error' },
            { label: `${summary.expired} Expired`, color: 'default' },
          ]}
        />
        <StatCard
          label="AWAITING REVIEW"
          total={summary.reviewable}
          segments={[{ name: 'Ready for review', value: summary.reviewable, color: '#ed6c02' }]}
          chips={[{ label: `${summary.reviewable} Ready`, color: 'warning' }]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Requested or pending with the Ready condition reported
            </Typography>
          }
        />
        <StatCard
          label="LIVE MANAGED ITEMS"
          total={summary.managedItems}
          segments={[{ name: 'Managed items', value: summary.managedItems, color: '#1976d2' }]}
          chips={[{ label: `${summary.managedItems} Objects`, color: 'primary' }]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Status-reported resources across visible requests
            </Typography>
          }
        />
      </SummaryCardGrid>

      <ResourceListView
        id="capsule-break-requests"
        title="Break Requests"
        data={items}
        headerProps={anchoredResourceListHeaderProps('Break Requests', {
          headerProps: { noNamespaceFilter: false },
        })}
        defaultSortingColumn={{ id: 'name', desc: false }}
        enableRowActions
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink
                crd={CAPSULE_CRDS.BreakRequest}
                name={item.getName()}
                namespace={item.getNamespace()}
              >
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          'namespace',
          {
            id: 'phase',
            label: 'Phase',
            getValue: item => breakRequestPhase(item),
            render: item => <BreakRequestPhaseChip item={item} />,
            filterVariant: 'select',
          },
          {
            id: 'requestor',
            label: 'Requestor',
            getValue: item => formatAccessEntity(item.spec?.requestor),
            render: item => {
              const subject = capsuleSubjectFromAccessEntity(item.spec?.requestor);
              return subject ? (
                <CapsuleSubjectLink subject={subject} namespaces={[item.getNamespace() || '']} />
              ) : (
                formatAccessEntity(item.spec?.requestor)
              );
            },
          },
          {
            id: 'template',
            label: 'Template',
            getValue: item => item.spec?.template?.name || '',
            render: item =>
              item.spec?.template?.name ? (
                <CapsuleResourceLink
                  crd={
                    item.spec.template.kind === 'BreakRequestTemplate'
                      ? CAPSULE_CRDS.BreakRequestTemplate
                      : CAPSULE_CRDS.GlobalBreakRequestTemplate
                  }
                  name={item.spec.template.name}
                  namespace={
                    item.spec.template.kind === 'BreakRequestTemplate'
                      ? item.getNamespace()
                      : undefined
                  }
                >
                  {item.spec.template.name}
                </CapsuleResourceLink>
              ) : (
                '—'
              ),
          },
          {
            id: 'reason',
            label: 'Reason',
            getValue: item => item.spec?.reason || '',
          },
          {
            id: 'duration',
            label: 'Duration',
            getValue: item => item.status?.approved?.duration || item.spec?.duration || '',
          },
          {
            id: 'ready',
            label: 'Ready',
            getValue: item =>
              String(
                item.status?.conditions?.find(condition => condition.type === 'Ready')?.status
              ),
            render: item => (
              <ConditionStatusChip
                status={
                  item.status?.conditions?.find(condition => condition.type === 'Ready')?.status
                }
                type="Ready"
              />
            ),
          },
          {
            id: 'items',
            label: 'Items',
            getValue: item => item.status?.size || item.status?.processedItems?.length || 0,
          },
          {
            id: 'review',
            label: 'Review',
            getValue: item => (breakRequestIsReviewable(item) ? 'Ready' : ''),
            render: item => <BreakRequestReviewButton item={item} />,
          },
          {
            id: 'expire',
            label: 'Expire',
            getValue: item => (canExpireBreakRequest(item) ? 'Available' : ''),
            render: item => <BreakRequestExpireButton item={item} />,
          },
          'age',
        ]}
      />
    </>
  );
}

export default BreakRequestsList;
