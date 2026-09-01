import { Icon } from '@iconify/react';
import { Activity, ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { BreakRequest } from '../../resources/breakRequests';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { CapsuleSubjectLink } from '../subjects/CapsuleSubjectLink';
import { capsuleSubjectFromAccessEntity } from '../subjects/subjectReferences';
import { BreakRequestCLICommand } from './BreakRequestCLICommand';
import {
  breakRequestIsReviewable,
  breakRequestPhase,
  breakRequestServiceAccountEntity,
  flattenRenderedBreakRequestTargets,
  formatAccessEntity,
} from './breakRequestHelpers';
import { BreakRequestResultingChanges } from './BreakRequestResultingChanges';
import {
  breakRequestReviewDateTimeInput,
  type BreakRequestReviewVerdict,
  buildBreakRequestReviewRequest,
  hasBreakRequestApprovalSnapshot,
  normalizeBreakRequestReviewStartTime,
} from './breakRequestReview';

export interface BreakRequestReviewProps {
  cluster?: string;
  name: string;
  namespace: string;
}

function currentCluster(item?: any): string | undefined {
  if (item?.cluster) return item.cluster;
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname.match(/^\/c\/([^/]+)/)?.[1];
}

export function openBreakRequestReviewActivity(item: any) {
  const name = item?.getName?.() || item?.metadata?.name || item?.jsonData?.metadata?.name;
  const namespace =
    item?.getNamespace?.() || item?.metadata?.namespace || item?.jsonData?.metadata?.namespace;
  if (!name || !namespace) return;

  const cluster = currentCluster(item);
  Activity.launch({
    id: `capsule-break-request-review ${namespace} ${name} ${cluster || ''}`,
    title: `Review BreakRequest ${namespace}/${name}`,
    hideTitleInHeader: true,
    location: 'split-right',
    temporary: true,
    cluster,
    content: <BreakRequestReview cluster={cluster} name={name} namespace={namespace} />,
    icon: <Icon icon="mdi:clipboard-check-outline" width="100%" height="100%" />,
  });
}

export function BreakRequestReviewButton({ item }: { item: any }) {
  if (!breakRequestIsReviewable(item)) return null;

  const openReview = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openBreakRequestReviewActivity(item);
  };

  return (
    <Button
      onClick={openReview}
      size="small"
      startIcon={<Icon icon="mdi:clipboard-check-outline" />}
      variant="outlined"
    >
      Review
    </Button>
  );
}

export function BreakRequestReview({ cluster, name, namespace }: BreakRequestReviewProps) {
  const [liveRequest, error] = BreakRequest.useGet(name, namespace, { cluster });
  const [refreshedRequest, setRefreshedRequest] = useState<BreakRequest | null>(null);
  const [verdict, setVerdict] = useState<BreakRequestReviewVerdict | ''>('');
  const [comment, setComment] = useState('');
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState('');
  const [lifecycleInitialized, setLifecycleInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const request = refreshedRequest || liveRequest;
  const targets = useMemo(() => flattenRenderedBreakRequestTargets(request), [request]);
  const reviewable = breakRequestIsReviewable(request);
  const hasSnapshot = hasBreakRequestApprovalSnapshot(request);
  const requestor = capsuleSubjectFromAccessEntity(request?.spec?.requestor);
  const executionEntity = breakRequestServiceAccountEntity(request);
  const executionSubject = capsuleSubjectFromAccessEntity(executionEntity);
  const normalizedStartTime = normalizeBreakRequestReviewStartTime(startTime);
  const startTimeError = verdict === 'Approved' && !normalizedStartTime;
  const submitRequest = verdict
    ? buildBreakRequestReviewRequest(
        request,
        verdict,
        comment,
        verdict === 'Approved' ? { duration, startTime } : undefined
      )
    : null;

  useEffect(() => {
    if (!request || lifecycleInitialized) return;
    setDuration(request.status?.approved?.duration || '');
    setStartTime(
      breakRequestReviewDateTimeInput(
        request.status?.approved?.startTime || new Date().toISOString()
      )
    );
    setLifecycleInitialized(true);
  }, [lifecycleInitialized, request]);

  const submit = async () => {
    if (!submitRequest || submitting) return;
    setSubmitting(true);
    try {
      await ApiProxy.patch(submitRequest.url, submitRequest.body, undefined, { cluster });
      try {
        const refreshed = await ApiProxy.request(submitRequest.url.replace(/\/status$/, ''), {
          cluster,
        });
        setRefreshedRequest(new BreakRequest(refreshed, cluster));
      } catch {
        // The active watch will still update this panel after the accepted status transition.
      }
      enqueueSnackbar(
        `${
          submitRequest.verdict === 'Approved' ? 'Approved' : 'Declined'
        } BreakRequest ${namespace}/${name}`,
        { variant: 'success' }
      );
    } catch (submitError: any) {
      enqueueSnackbar(
        `Failed to submit BreakRequest review: ${submitError?.message || String(submitError)}`,
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <SectionBox title={`Review: ${namespace}/${name}`}>
        <Alert severity="error">
          This BreakRequest cannot be loaded directly or this account does not have get access.
        </Alert>
      </SectionBox>
    );
  }

  if (!request) {
    return (
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, p: 2 }}>
        <CircularProgress size={20} />
        <Typography>Loading BreakRequest…</Typography>
      </Box>
    );
  }

  return (
    <>
      <SectionBox title={`Review: ${namespace}/${name}`}>
        <Stack gap={1.5}>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Chip label={breakRequestPhase(request)} color={reviewable ? 'warning' : 'default'} />
            {request.spec?.template?.name && (
              <CapsuleResourceLink
                crd={
                  request.spec?.template?.kind === 'BreakRequestTemplate'
                    ? CAPSULE_CRDS.BreakRequestTemplate
                    : CAPSULE_CRDS.GlobalBreakRequestTemplate
                }
                name={request.spec.template.name}
                namespace={
                  request.spec?.template?.kind === 'BreakRequestTemplate' ? namespace : undefined
                }
              >
                Template: {request.spec.template.name}
              </CapsuleResourceLink>
            )}
          </Stack>
          <Typography>
            <strong>Requestor:</strong>{' '}
            {requestor ? (
              <CapsuleSubjectLink subject={requestor} namespaces={[namespace]} />
            ) : (
              formatAccessEntity(request.spec?.requestor)
            )}
          </Typography>
          <Typography>
            <strong>Reason:</strong> {request.spec?.reason || '—'}
          </Typography>
          {executionEntity && (
            <Typography>
              <strong>Execution ServiceAccount:</strong>{' '}
              {executionSubject ? (
                <CapsuleSubjectLink
                  subject={executionSubject}
                  namespaces={
                    [
                      ...new Set([namespace, executionSubject.namespace].filter(Boolean)),
                    ] as string[]
                  }
                />
              ) : (
                formatAccessEntity(executionEntity)
              )}
            </Typography>
          )}
          <Typography>
            <strong>Effective duration:</strong> {request.status?.approved?.duration || 'Unlimited'}
          </Typography>
          <BreakRequestCLICommand action="review" name={name} namespace={namespace} />
        </Stack>
      </SectionBox>

      <SectionBox title="Resulting Changes">
        {hasSnapshot ? (
          <BreakRequestResultingChanges cluster={cluster} targets={targets} />
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            The controller has not published <code>status.approved</code>. Approval is disabled
            because the review must not infer or recreate the rendered resources. You can still
            decline this request.
          </Alert>
        )}
      </SectionBox>

      <SectionBox title="Verdict">
        {!reviewable && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This request is in phase {breakRequestPhase(request)} and is no longer awaiting a
            review.
          </Alert>
        )}
        <Stack gap={2}>
          <FormControl disabled={!reviewable || submitting}>
            <FormLabel id={`break-request-verdict-${namespace}-${name}`}>Verdict</FormLabel>
            <RadioGroup
              aria-labelledby={`break-request-verdict-${namespace}-${name}`}
              onChange={event => setVerdict(event.target.value as BreakRequestReviewVerdict)}
              value={verdict}
            >
              <FormControlLabel
                control={<Radio />}
                disabled={!hasSnapshot}
                label="Approve"
                value="Approved"
              />
              <FormControlLabel control={<Radio />} label="Decline" value="Denied" />
            </RadioGroup>
          </FormControl>
          <Paper
            variant="outlined"
            sx={{
              bgcolor: 'action.hover',
              borderColor: 'divider',
              p: 2,
            }}
          >
            <Stack gap={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  Approval timing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Reviewers may adjust the effective access window before approving. These values
                  are ignored when declining.
                </Typography>
              </Box>
              <TextField
                disabled={!reviewable || submitting || verdict === 'Denied'}
                fullWidth
                helperText="Change the effective duration if needed. Leave blank for unlimited access."
                label="Duration"
                onChange={event => setDuration(event.target.value)}
                placeholder="For example: 1h"
                value={duration}
              />
              <TextField
                disabled={!reviewable || submitting || verdict === 'Denied'}
                error={startTimeError}
                fullWidth
                helperText={
                  startTimeError
                    ? 'Choose the effective start time before approving.'
                    : 'Change when access begins, or keep the prefilled effective value.'
                }
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 1 }}
                label="Start time"
                onChange={event => setStartTime(event.target.value)}
                required={verdict === 'Approved'}
                type="datetime-local"
                value={startTime}
              />
            </Stack>
          </Paper>
          <TextField
            disabled={!reviewable || submitting}
            error={comment.length > 0 && !comment.trim()}
            fullWidth
            label="Review comment"
            minRows={4}
            multiline
            onChange={event => setComment(event.target.value)}
            required
            value={comment}
          />
          <Button
            color={verdict === 'Denied' ? 'error' : 'primary'}
            disabled={!submitRequest || submitting}
            onClick={submit}
            startIcon={
              submitting ? (
                <CircularProgress color="inherit" size={18} />
              ) : (
                <Icon icon={verdict === 'Denied' ? 'mdi:close-circle-outline' : 'mdi:check'} />
              )
            }
            variant="contained"
          >
            {verdict === 'Denied'
              ? 'Decline request'
              : verdict === 'Approved'
              ? 'Submit approval'
              : 'Select a verdict'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Your authenticated Kubernetes identity is recorded by the admission webhook; the browser
            never supplies the reviewer field.
          </Typography>
        </Stack>
      </SectionBox>
    </>
  );
}

export default BreakRequestReview;
