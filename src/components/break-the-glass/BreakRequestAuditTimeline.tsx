import { Icon } from '@iconify/react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CapsuleSubjectLink } from '../subjects/CapsuleSubjectLink';
import { capsuleSubjectFromAccessEntity } from '../subjects/subjectReferences';
import { type BreakRequestAuditEntry, breakRequestPhasePresentation } from './breakRequestHelpers';

function dateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Time not reported';
}

export function BreakRequestAuditTimeline({
  entries,
  namespace,
}: {
  entries: BreakRequestAuditEntry[];
  namespace?: string;
}) {
  if (entries.length === 0) {
    return <Typography color="text.secondary">No audit entries reported.</Typography>;
  }

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {entries.map((entry, index) => {
        const style = breakRequestPhasePresentation(entry.stage);
        const subject = capsuleSubjectFromAccessEntity(entry.actorEntity);
        const subjectNamespaces = [namespace, subject?.namespace].filter(Boolean) as string[];
        return (
          <Box
            component="li"
            key={`${entry.stage}-${entry.timestamp || index}-${index}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: '42px minmax(0, 1fr)',
              pb: 2,
              position: 'relative',
            }}
          >
            {index < entries.length - 1 && (
              <Box
                aria-hidden
                sx={{
                  bgcolor: alpha(style.color, 0.45),
                  bottom: -8,
                  left: 20,
                  position: 'absolute',
                  top: 38,
                  width: 2,
                }}
              />
            )}
            <Box
              aria-hidden
              sx={{
                alignItems: 'center',
                bgcolor: style.color,
                border: '3px solid',
                borderColor: 'background.paper',
                borderRadius: '50%',
                boxShadow: 1,
                color: 'common.white',
                display: 'flex',
                height: 34,
                justifyContent: 'center',
                mt: 0.75,
                width: 34,
                zIndex: 1,
              }}
            >
              <Icon icon={style.icon} width={19} height={19} />
            </Box>
            <Paper
              variant="outlined"
              sx={{
                bgcolor: alpha(style.color, 0.09),
                borderColor: alpha(style.color, 0.55),
                borderLeft: `5px solid ${style.color}`,
                minWidth: 0,
                p: 1.75,
              }}
            >
              <Stack gap={1}>
                <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                  <Chip
                    size="small"
                    label={entry.stage}
                    sx={{
                      bgcolor: style.color,
                      color: 'common.white',
                      fontWeight: 700,
                    }}
                  />
                  {entry.verdict && entry.verdict !== 'Pending' && (
                    <Chip
                      color={entry.verdict === 'Approved' ? 'success' : 'error'}
                      icon={
                        <Icon
                          icon={entry.verdict === 'Approved' ? 'mdi:check-bold' : 'mdi:close-thick'}
                        />
                      }
                      label={`Verdict: ${entry.verdict}`}
                      size="small"
                    />
                  )}
                </Stack>
                <Box
                  sx={theme => ({
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    bgcolor: alpha(style.color, 0.12),
                    border: 1,
                    borderColor: alpha(style.color, 0.5),
                    borderRadius: 1,
                    color: theme.palette.text.primary,
                    display: 'flex',
                    gap: 0.75,
                    px: 1.1,
                    py: 0.65,
                  })}
                >
                  <Icon icon="mdi:calendar-clock" width={18} height={18} />
                  <Typography variant="body2" fontWeight={700}>
                    Timestamp: {dateTime(entry.timestamp)}
                  </Typography>
                </Box>
              </Stack>
              <Typography sx={{ mt: 1 }}>{entry.message}</Typography>
              <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Actor:{' '}
                {subject ? (
                  <CapsuleSubjectLink
                    subject={subject}
                    namespaces={
                      subjectNamespaces.length ? [...new Set(subjectNamespaces)] : undefined
                    }
                  />
                ) : (
                  entry.actor
                )}
              </Typography>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}

export default BreakRequestAuditTimeline;
