import { Icon } from '@iconify/react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';

export type BreakRequestCLIAction = 'expire' | 'review';

export function buildBreakRequestCLICommand(
  action: BreakRequestCLIAction,
  name: string,
  namespace: string
): string {
  return `kubectl capsule btg ${action} ${name} -n ${namespace}`;
}

export function BreakRequestCLICommand({
  action,
  name,
  namespace,
}: {
  action: BreakRequestCLIAction;
  name: string;
  namespace: string;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const command = buildBreakRequestCLICommand(action, name, namespace);
  const label = action === 'review' ? 'Review from terminal' : 'Expire from terminal';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      enqueueSnackbar('Command copied to clipboard', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(`Failed to copy command: ${error?.message || String(error)}`, {
        variant: 'error',
      });
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          alignItems: { sm: 'center' },
          bgcolor: 'action.hover',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          overflow: 'hidden',
          p: 1,
        }}
      >
        <Box
          component="code"
          sx={{
            flex: 1,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.8rem',
            minWidth: 0,
            overflowX: 'auto',
            px: 1,
            py: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          {command}
        </Box>
        <Stack direction="row" justifyContent="flex-end">
          <Button
            aria-label={`Copy ${action} command`}
            onClick={copy}
            size="small"
            startIcon={<Icon icon="mdi:content-copy" />}
            variant="outlined"
          >
            Copy
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default BreakRequestCLICommand;
