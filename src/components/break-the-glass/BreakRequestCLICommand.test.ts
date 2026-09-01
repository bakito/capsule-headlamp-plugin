import { describe, expect, it } from 'vitest';
import { buildBreakRequestCLICommand } from './BreakRequestCLICommand';

describe('BreakRequest CLI commands', () => {
  it('builds the interactive review command', () => {
    expect(buildBreakRequestCLICommand('review', 'customquotas-editor-alice', 'solar-test')).toBe(
      'kubectl capsule btg review customquotas-editor-alice -n solar-test'
    );
  });

  it('builds the expire command', () => {
    expect(buildBreakRequestCLICommand('expire', 'temporary-admin', 'solar-prod')).toBe(
      'kubectl capsule btg expire temporary-admin -n solar-prod'
    );
  });
});
