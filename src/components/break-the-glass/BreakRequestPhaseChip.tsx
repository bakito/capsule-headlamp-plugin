import { Icon } from '@iconify/react';
import { Chip } from '@mui/material';
import { breakRequestPhase, breakRequestPhasePresentation } from './breakRequestHelpers';

export function BreakRequestPhaseChip({ item }: { item: any }) {
  const phase = breakRequestPhase(item);
  const presentation = breakRequestPhasePresentation(phase);
  return (
    <Chip
      icon={<Icon icon={presentation.icon} />}
      label={phase}
      size="small"
      sx={{
        bgcolor: presentation.color,
        color: 'common.white',
        fontWeight: 700,
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
}

export default BreakRequestPhaseChip;
