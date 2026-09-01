import { Icon } from '@iconify/react';
import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Alert, Button, Chip, Collapse, Stack, Typography } from '@mui/material';
import { type ReactNode, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BreakRequest } from '../../resources/breakRequests';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { ManagedResources } from '../common/ManagedResources';
import { CapsuleSubjectLink } from '../subjects/CapsuleSubjectLink';
import { capsuleSubjectFromAccessEntity } from '../subjects/subjectReferences';
import { BreakRequestAuditTimeline } from './BreakRequestAuditTimeline';
import {
  breakRequestAuditTrail,
  breakRequestPhase,
  breakRequestReviewRecorded,
  breakRequestServiceAccountEntity,
  formatAccessEntity,
} from './breakRequestHelpers';
import { BreakRequestPhaseChip } from './BreakRequestPhaseChip';

export interface BreakRequestDetailProps {
  name?: string;
  namespace?: string;
}

function dateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '—';
}

function subjectNamespaces(requestNamespace: string, subject?: { namespace?: string }) {
  return [...new Set([requestNamespace, subject?.namespace].filter(Boolean))] as string[];
}

function CollapsibleTableSection({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SectionBox
      title={title}
      headerProps={{
        titleSideActions: [
          <Button
            aria-expanded={expanded}
            key={`${title}-table-toggle`}
            onClick={() => setExpanded(value => !value)}
            size="small"
            startIcon={<Icon icon={expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} />}
            variant="outlined"
          >
            {expanded ? 'Collapse' : 'Expand'} ({count})
          </Button>,
        ],
      }}
    >
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
      {!expanded && (
        <Typography color="text.secondary" variant="body2">
          {count === 0 ? 'No entries.' : `${count} ${count === 1 ? 'entry' : 'entries'} hidden.`}
        </Typography>
      )}
    </SectionBox>
  );
}

export function BreakRequestDetail(props: BreakRequestDetailProps) {
  const params = useParams<{ crName?: string; name?: string; namespace?: string }>();
  const name = props.name || params.crName || params.name || '';
  const namespace = props.namespace || (params.namespace === '-' ? '' : params.namespace) || '';
  const [request, error] = BreakRequest.useGet(name, namespace);
  const auditTrail = useMemo(() => breakRequestAuditTrail(request), [request]);
  const requestParams = useMemo(
    () =>
      Object.entries(request?.spec?.params || {}).sort(([left], [right]) =>
        left.localeCompare(right)
      ),
    [request]
  );
  const phase = breakRequestPhase(request);
  const processedItems = request?.status?.processedItems || [];
  const requestorSubject = capsuleSubjectFromAccessEntity(request?.spec?.requestor);
  const serviceAccountEntity = breakRequestServiceAccountEntity(request);
  const serviceAccountSubject = capsuleSubjectFromAccessEntity(serviceAccountEntity);
  const reviewRecorded = breakRequestReviewRecorded(request);
  const reviewEntity = request?.status?.review?.reviewer?.name
    ? request.status.review.reviewer
    : serviceAccountEntity;
  const reviewerSubject = capsuleSubjectFromAccessEntity(reviewEntity);

  if (error) {
    return (
      <SectionBox title={`Break Request: ${name}`}>
        <Alert severity="error">
          BreakRequest {namespace ? `${namespace}/` : ''}
          {name} is unavailable or this account cannot read it directly.
        </Alert>
      </SectionBox>
    );
  }

  return (
    <Resource.DetailsGrid
      name={name}
      namespace={namespace}
      resourceType={BreakRequest}
      extraInfo={item => {
        if (!item) return [];
        const templateName = item.spec?.template?.name;
        const requestor = capsuleSubjectFromAccessEntity(item.spec?.requestor);
        const executionEntity = breakRequestServiceAccountEntity(item);
        const executionSubject = capsuleSubjectFromAccessEntity(executionEntity);
        return [
          { name: 'Phase', value: <BreakRequestPhaseChip item={item} /> },
          {
            name: 'Requestor',
            value: requestor ? (
              <CapsuleSubjectLink
                subject={requestor}
                namespaces={subjectNamespaces(namespace, requestor)}
              />
            ) : (
              <Typography>{formatAccessEntity(item.spec?.requestor)}</Typography>
            ),
          },
          {
            name: 'Template',
            value: templateName ? (
              <CapsuleResourceLink
                crd={
                  item.spec?.template?.kind === 'BreakRequestTemplate'
                    ? CAPSULE_CRDS.BreakRequestTemplate
                    : CAPSULE_CRDS.GlobalBreakRequestTemplate
                }
                name={templateName}
                namespace={
                  item.spec?.template?.kind === 'BreakRequestTemplate' ? namespace : undefined
                }
              >
                {templateName}
              </CapsuleResourceLink>
            ) : (
              <Typography>—</Typography>
            ),
          },
          {
            name: 'Duration',
            value: (
              <Typography>
                {item.status?.approved?.duration || item.spec?.duration || '—'}
              </Typography>
            ),
          },
          {
            name: 'Managed items',
            value: <Chip size="small" label={item.status?.size || 0} color="primary" />,
          },
          ...(executionEntity
            ? [
                {
                  name: 'Execution ServiceAccount',
                  value: executionSubject ? (
                    <CapsuleSubjectLink
                      subject={executionSubject}
                      namespaces={subjectNamespaces(namespace, executionSubject)}
                    />
                  ) : (
                    <Typography>{formatAccessEntity(executionEntity)}</Typography>
                  ),
                },
              ]
            : []),
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={request} />

        <CollapsibleTableSection
          key={`request-${namespace}-${name}`}
          count={serviceAccountEntity ? 10 : 9}
          title="Request"
        >
          <SimpleTable
            columns={[
              {
                label: 'Field',
                getter: (row: { field: string; value: ReactNode }) => row.field,
              },
              {
                label: 'Value',
                getter: (row: { field: string; value: ReactNode }) => row.value,
              },
            ]}
            data={[
              { field: 'Reason', value: request?.spec?.reason || '—' },
              {
                field: 'Requestor',
                value: requestorSubject ? (
                  <CapsuleSubjectLink
                    subject={requestorSubject}
                    namespaces={subjectNamespaces(namespace, requestorSubject)}
                  />
                ) : (
                  formatAccessEntity(request?.spec?.requestor)
                ),
              },
              ...(serviceAccountEntity
                ? [
                    {
                      field: 'Execution ServiceAccount',
                      value: serviceAccountSubject ? (
                        <CapsuleSubjectLink
                          subject={serviceAccountSubject}
                          namespaces={subjectNamespaces(namespace, serviceAccountSubject)}
                        />
                      ) : (
                        formatAccessEntity(serviceAccountEntity)
                      ),
                    },
                  ]
                : []),
              { field: 'Requested duration', value: request?.spec?.duration || 'Template default' },
              { field: 'Requested start', value: dateTime(request?.spec?.startTime) },
              { field: 'Approved duration', value: request?.status?.approved?.duration || '—' },
              { field: 'Approved start', value: dateTime(request?.status?.approved?.startTime) },
              { field: 'Active from', value: dateTime(request?.status?.active?.from) },
              { field: 'Active until', value: dateTime(request?.status?.active?.until) },
              { field: 'Audit retention until', value: dateTime(request?.status?.keepUntil) },
            ]}
            emptyMessage="No request data."
            reflectInURL={false}
          />
        </CollapsibleTableSection>

        <CollapsibleTableSection
          key={`parameters-${namespace}-${name}`}
          count={requestParams.length}
          title="Parameters"
        >
          <SimpleTable
            columns={[
              { label: 'Parameter', getter: (entry: [string, unknown]) => entry[0] },
              {
                label: 'Value',
                getter: (entry: [string, unknown]) =>
                  typeof entry[1] === 'string' ? entry[1] : JSON.stringify(entry[1]),
              },
            ]}
            data={requestParams}
            defaultSortingColumn={1}
            emptyMessage="No request parameters."
            reflectInURL={false}
          />
        </CollapsibleTableSection>

        <SectionBox title="Audit Trail">
          <BreakRequestAuditTimeline entries={auditTrail} namespace={namespace} />
        </SectionBox>

        {reviewRecorded && (
          <SectionBox title="Review Verdict">
            <Stack gap={2}>
              <Alert
                severity={
                  request?.status?.review?.verdict === 'Denied'
                    ? 'error'
                    : request?.status?.review?.verdict === 'Approved'
                    ? 'success'
                    : 'info'
                }
              >
                Review verdict: <strong>{request?.status?.review?.verdict || 'Recorded'}</strong>
              </Alert>
              <SimpleTable
                columns={[
                  {
                    label: 'Field',
                    getter: (row: { field: string; value: ReactNode }) => row.field,
                  },
                  {
                    label: 'Value',
                    getter: (row: { field: string; value: ReactNode }) => row.value,
                  },
                ]}
                data={[
                  {
                    field: 'Reviewed by',
                    value: reviewerSubject ? (
                      <CapsuleSubjectLink
                        subject={reviewerSubject}
                        namespaces={subjectNamespaces(namespace, reviewerSubject)}
                      />
                    ) : (
                      formatAccessEntity(reviewEntity)
                    ),
                  },
                  {
                    field: 'Comment',
                    value: request?.status?.review?.message || 'No comment provided.',
                  },
                ]}
                emptyMessage=""
                reflectInURL={false}
              />
            </Stack>
          </SectionBox>
        )}

        {(phase === 'Active' || processedItems.length > 0) && (
          <ManagedResources inventoryTitle={null} item={request} title="Live Managed Resources" />
        )}
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

export default BreakRequestDetail;
