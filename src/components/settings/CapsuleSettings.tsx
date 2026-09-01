import type { PluginSettingsDetailsProps } from '@kinvolk/headlamp-plugin/lib';
import { Box, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import {
  DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL,
  isDocumentationBaseUrlValid,
} from '../common/capsuleDocumentation';
import { type CapsulePluginConfig, sectionAnchorsEnabled } from '../common/capsulePluginConfig';

export function CapsuleSettings({ data, onDataChange }: PluginSettingsDetailsProps) {
  const config = (data || {}) as CapsulePluginConfig;
  const documentationBaseUrl =
    config.documentationBaseUrl ?? DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL;
  const valid = isDocumentationBaseUrlValid(documentationBaseUrl);
  const anchorsEnabled = sectionAnchorsEnabled(config);

  return (
    <Box sx={{ mt: 2, maxWidth: 760 }}>
      <Stack spacing={3}>
        <TextField
          fullWidth
          label="Documentation base URL"
          value={documentationBaseUrl}
          error={!valid}
          helperText={
            valid
              ? 'Base URL used by documentation actions. Clear it to use projectcapsule.dev.'
              : 'Enter an absolute HTTP or HTTPS URL.'
          }
          onChange={event =>
            onDataChange?.({
              ...data,
              documentationBaseUrl: event.target.value,
            })
          }
        />
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={anchorsEnabled}
                onChange={event =>
                  onDataChange?.({
                    ...data,
                    sectionAnchorsEnabled: event.target.checked,
                  })
                }
              />
            }
            label="Shareable section links"
          />
          <Typography color="text.secondary" variant="body2">
            Adds fragment-link buttons beside Capsule section headings. Disabled by default in
            Headlamp Desktop because Desktop uses URL hashes for routing.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
