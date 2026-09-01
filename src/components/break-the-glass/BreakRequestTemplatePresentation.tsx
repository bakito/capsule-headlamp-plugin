import { Icon } from '@iconify/react';
import { Box, Stack, Typography } from '@mui/material';
import { TenantVisualIcon } from '../common/TenantVisualIcon';
import { breakRequestTemplateDescription, breakRequestTemplateIcon } from './breakRequestHelpers';

export function BreakRequestTemplateIcon({
  size = 28,
  template,
}: {
  size?: number;
  template: any;
}) {
  const icon = breakRequestTemplateIcon(template);
  return (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: 'primary.main',
        borderRadius: 1.5,
        color: 'primary.contrastText',
        display: 'inline-flex',
        flex: '0 0 auto',
        height: size + 14,
        justifyContent: 'center',
        width: size + 14,
      }}
    >
      {icon ? (
        <TenantVisualIcon icon={icon} size={size} />
      ) : (
        <Icon aria-hidden icon="mdi:shield-key-outline" width={size} height={size} />
      )}
    </Box>
  );
}

export function BreakRequestTemplateIdentity({
  compact = false,
  template,
}: {
  compact?: boolean;
  template: any;
}) {
  const description = breakRequestTemplateDescription(template);
  return (
    <Stack direction="row" gap={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <BreakRequestTemplateIcon template={template} size={compact ? 22 : 30} />
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={700} noWrap={compact}>
          {template?.getName?.() || template?.metadata?.name || template?.jsonData?.metadata?.name}
        </Typography>
        <Typography
          color="text.secondary"
          variant="body2"
          sx={
            compact
              ? {
                  maxWidth: 420,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              : undefined
          }
        >
          {description || 'No description provided.'}
        </Typography>
      </Box>
    </Stack>
  );
}

export default BreakRequestTemplateIdentity;
