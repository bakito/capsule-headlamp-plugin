import { Icon } from '@iconify/react';
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { ActionButton } from '@kinvolk/headlamp-plugin/lib/components/common';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { type MouseEvent, useState } from 'react';
import { BreakRequestCLICommand } from './BreakRequestCLICommand';
import {
  buildBreakRequestExpireRequest,
  canExpireBreakRequest,
  replaceBreakRequestData,
} from './breakRequestExpire';
import { breakRequestPhase } from './breakRequestHelpers';

function actionResource(props: any) {
  let resource = props.item || props.resource;
  if (resource?.item && !resource.jsonData && !resource.kind) resource = resource.item;
  return resource;
}

function resourceCluster(item: any): string | undefined {
  if (item?.cluster) return item.cluster;
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname.match(/^\/c\/([^/]+)/)?.[1];
}

function useExpireBreakRequest(item: any) {
  const [updating, setUpdating] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const expire = async () => {
    const request = buildBreakRequestExpireRequest(item);
    if (!request || updating) return false;

    const cluster = resourceCluster(item);
    setUpdating(true);
    try {
      await ApiProxy.patch(request.url, request.body, undefined, { cluster });
      try {
        const refreshed = await ApiProxy.request(request.resourceUrl, { cluster });
        replaceBreakRequestData(item, refreshed);
      } catch {
        // The resource watch will still reconcile after the accepted transition.
      }
      enqueueSnackbar(`Expired BreakRequest ${request.namespace}/${request.name}`, {
        variant: 'success',
      });
      return true;
    } catch (error: any) {
      enqueueSnackbar(`Failed to expire BreakRequest: ${error?.message || String(error)}`, {
        variant: 'error',
      });
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return { expire, updating };
}

function BreakRequestExpireDialog({
  item,
  onCancel,
  onConfirm,
  open,
  updating,
}: {
  item: any;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  updating: boolean;
}) {
  const request = buildBreakRequestExpireRequest(item);
  if (!request) return null;

  return (
    <Dialog
      aria-describedby="break-request-expire-description"
      aria-labelledby="break-request-expire-title"
      fullWidth
      maxWidth="sm"
      onClose={updating ? undefined : onCancel}
      open={open}
    >
      <DialogTitle id="break-request-expire-title">Expire BreakRequest?</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Typography fontWeight={600}>
              {request.namespace}/{request.name}
            </Typography>
            <Chip label={breakRequestPhase(item)} size="small" variant="outlined" />
          </Stack>
          <Alert severity="warning">
            Expiring this request immediately revokes active access and moves it to a terminal
            lifecycle phase. This action cannot be undone.
          </Alert>
          <Typography id="break-request-expire-description" color="text.secondary">
            The request may remain visible until its configured audit-retention period ends.
          </Typography>
          <BreakRequestCLICommand
            action="expire"
            name={request.name}
            namespace={request.namespace}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={updating} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          color="error"
          disabled={updating}
          onClick={onConfirm}
          startIcon={
            updating ? (
              <CircularProgress color="inherit" size={16} />
            ) : (
              <Icon icon="mdi:timer-remove-outline" />
            )
          }
          variant="contained"
        >
          Expire request
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function BreakRequestExpireButton({ item }: { item: any }) {
  const [confirming, setConfirming] = useState(false);
  const { expire, updating } = useExpireBreakRequest(item);
  if (!canExpireBreakRequest(item)) return null;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setConfirming(true);
  };

  const confirm = async () => {
    if (await expire()) setConfirming(false);
  };

  return (
    <>
      <Button
        color="error"
        disabled={updating}
        onClick={handleClick}
        size="small"
        startIcon={<Icon icon="mdi:timer-remove-outline" />}
        variant="outlined"
      >
        Expire
      </Button>
      <BreakRequestExpireDialog
        item={item}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        open={confirming}
        updating={updating}
      />
    </>
  );
}

export function BreakRequestExpireAction(props: any) {
  const resource = actionResource(props);
  const [confirming, setConfirming] = useState(false);
  const { expire, updating } = useExpireBreakRequest(resource);
  if (!canExpireBreakRequest(resource)) return null;

  const confirm = async () => {
    if (await expire()) {
      setConfirming(false);
      props.closeMenu?.();
    }
  };

  return (
    <>
      <ActionButton
        buttonStyle={props.buttonStyle}
        color="secondary"
        description="Expire BreakRequest"
        longDescription="Expire this request immediately and revoke any active access"
        icon="mdi:timer-remove-outline"
        iconButtonProps={{ disabled: updating, 'aria-busy': updating }}
        onClick={() => setConfirming(true)}
      />
      <BreakRequestExpireDialog
        item={resource}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        open={confirming}
        updating={updating}
      />
    </>
  );
}

export default BreakRequestExpireAction;
