// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourcePermitSetupForm } from './CreateResourcePermitActivity';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  enqueueSnackbar: vi.fn(),
  template: {
    spec: { paramSchema: { type: 'object', properties: {} } },
    status: { namespaces: ['*'] },
  },
}));
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  Activity: { close: mocks.close },
  ApiProxy: { post: mocks.post },
  Router: {
    createRouteURL: (_: string, p: any) =>
      `/c/${p.cluster}/customresources/${p.crd}/${p.namespace}/${p.crName}`,
  },
}));
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: mocks.push }) }));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }) }));
vi.mock('../../resources/resourcePermits', () => ({
  GlobalResourcePermitTemplate: { useGet: () => [mocks.template, null] },
  ResourcePermitTemplate: { useGet: () => [mocks.template, null] },
}));
vi.mock('../common/AnchoredSectionBox', () => ({
  AnchoredSectionBox: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../common/CapsuleResourceLink', () => ({
  CapsuleResourceLink: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('./ResourcePermitTemplatePresentation', () => ({
  ResourcePermitTemplateIdentity: () => null,
}));
vi.mock('./ResourcePermitYamlDialog', () => ({ ResourcePermitYamlDialog: () => null }));
vi.mock('./KubernetesResourceSchemaFieldInput', () => ({
  KubernetesResourceSchemaWidget: () => null,
}));

describe('ResourcePermit setup', () => {
  beforeEach(() => vi.clearAllMocks());

  async function submitGeneratedRequest() {
    render(
      <ResourcePermitSetupForm
        cluster="main"
        namespaces={['solar-test']}
        templateKind="GlobalResourcePermitTemplate"
        templateName="access"
      />
    );
    expect(
      (screen.getByRole('checkbox', { name: 'Generate a unique request name' }) as HTMLInputElement)
        .checked
    ).toBe(true);
    expect((screen.getByLabelText('Reason') as HTMLInputElement).required).toBe(false);
    fireEvent.change(screen.getByLabelText('ResourcePermit name prefix', { exact: false }), {
      target: { value: 'incident' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Template Parameters' }));
    const createButton = await screen.findByRole('button', { name: 'Create ResourcePermit' });
    await act(async () => fireEvent.click(createButton));
  }

  it('creates without a reason and navigates to the generated object, closing only its wizard', async () => {
    mocks.post.mockResolvedValue({ metadata: { name: 'incident-x7j2q', namespace: 'solar-test' } });
    await submitGeneratedRequest();
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        '/c/main/customresources/resourcepermits.capsule.clastix.io/solar-test/incident-x7j2q'
      )
    );
    expect(mocks.post.mock.calls[0][1].metadata).toEqual({
      generateName: 'incident-',
      namespace: 'solar-test',
    });
    expect(mocks.post.mock.calls[0][1].spec).not.toHaveProperty('reason');
    expect(mocks.close).toHaveBeenCalledWith('capsule-create-resource-permit solar-test main');
  });

  it('keeps the wizard open after an API failure', async () => {
    mocks.post.mockRejectedValue(new Error('Request rejected'));
    await submitGeneratedRequest();
    expect(await screen.findByText('Request rejected')).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
