import { describe, expect, it } from 'vitest';
import { breakRequestYaml, breakRequestYamlFilename } from './BreakRequestYamlDialog';

describe('BreakRequest YAML export', () => {
  it('serializes the exact request object without adding a requestor', () => {
    const resource = {
      apiVersion: 'capsule.clastix.io/v1beta2',
      kind: 'BreakRequest',
      metadata: { name: 'incident-access', namespace: 'solar-test' },
      spec: {
        params: { clusterRoles: ['view', 'edit'] },
        reason: 'Incident 42',
        template: { kind: 'GlobalBreakRequestTemplate', name: 'clusterrole-binding' },
      },
    };

    const yaml = breakRequestYaml(resource);

    expect(yaml).toBe(`apiVersion: capsule.clastix.io/v1beta2
kind: BreakRequest
metadata:
  name: incident-access
  namespace: solar-test
spec:
  params:
    clusterRoles:
      - view
      - edit
  reason: Incident 42
  template:
    kind: GlobalBreakRequestTemplate
    name: clusterrole-binding
`);
    expect(yaml).not.toContain('requestor:');
    expect(breakRequestYamlFilename(resource)).toBe('incident-access.yaml');
  });

  it('uses the generated-name prefix for the download filename', () => {
    expect(breakRequestYamlFilename({ metadata: { generateName: 'incident-access-' } })).toBe(
      'incident-access.yaml'
    );
    expect(breakRequestYamlFilename({})).toBe('breakrequest.yaml');
  });
});
