import { Icon } from '@iconify/react';
import { toYamlString } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useMemo } from 'react';

export function breakRequestYaml(resource: any): string {
  return toYamlString(resource);
}

export function breakRequestYamlFilename(resource: any): string {
  const metadata = resource?.metadata || {};
  const baseName = String(metadata.name || metadata.generateName || 'breakrequest')
    .trim()
    .replace(/-+$/, '');
  return `${baseName || 'breakrequest'}.yaml`;
}

export function BreakRequestYamlDialog({
  onClose,
  open,
  resource,
}: {
  onClose: () => void;
  open: boolean;
  resource: any;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const yaml = useMemo(() => breakRequestYaml(resource), [resource]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      enqueueSnackbar('BreakRequest YAML copied to clipboard', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(`Failed to copy YAML: ${error?.message || String(error)}`, {
        variant: 'error',
      });
    }
  };

  const download = () => {
    const blob = new Blob([yaml], { type: 'application/x-yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = breakRequestYamlFilename(resource);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>BreakRequest YAML</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Alert severity="info">
            This optional preview contains the values currently entered in the wizard. The
            authenticated requestor is added by the Capsule admission webhook when the request is
            created.
          </Alert>
          <Box
            aria-label="BreakRequest YAML"
            component="pre"
            sx={{
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.8rem',
              m: 0,
              maxHeight: '60vh',
              overflow: 'auto',
              p: 2,
              whiteSpace: 'pre',
            }}
          >
            {yaml}
          </Box>
          <Typography color="text.secondary" variant="caption">
            Previewing, copying, or downloading this manifest does not create the BreakRequest.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, p: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          onClick={() => void copy()}
          startIcon={<Icon icon="mdi:content-copy" />}
          variant="outlined"
        >
          Copy YAML
        </Button>
        <Button
          onClick={download}
          startIcon={<Icon icon="mdi:file-download-outline" />}
          variant="contained"
        >
          Download YAML
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BreakRequestYamlDialog;
