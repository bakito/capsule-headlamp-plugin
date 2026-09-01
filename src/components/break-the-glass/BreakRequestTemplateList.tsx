import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Alert, Box, Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { BreakRequestTemplate, GlobalBreakRequestTemplate } from '../../resources/breakRequests';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import {
  breakRequestNamespacesFromSearch,
  breakRequestTemplateDescription,
  combineBreakRequestTemplates,
  templateApprovalMode,
  templateNamespaces,
  templateTargetCount,
} from './breakRequestHelpers';
import { BreakRequestTemplateIcon } from './BreakRequestTemplatePresentation';

export function BreakRequestTemplatesList() {
  const location = useLocation();
  const namespaceScope = useMemo(
    () => breakRequestNamespacesFromSearch(location.search),
    [location.search]
  );
  const [namespacedItems, namespacedError] = BreakRequestTemplate.useList({
    namespace: namespaceScope.length ? namespaceScope : undefined,
  });
  const [globalItems, globalError] = GlobalBreakRequestTemplate.useList();
  const items = useMemo(() => {
    if (!namespacedItems && !globalItems && !namespacedError && !globalError) return null;
    return combineBreakRequestTemplates(namespacedItems, globalItems);
  }, [globalError, globalItems, namespacedError, namespacedItems]);
  const summary = useMemo(() => {
    let automatic = 0;
    let manual = 0;
    let targets = 0;
    const namespaces = new Set<string>();
    let unrestricted = false;

    for (const item of items || []) {
      if (templateApprovalMode(item) === 'Automatic') automatic += 1;
      else manual += 1;
      targets += templateTargetCount(item);
      if (item.getNamespace()) {
        namespaces.add(item.getNamespace()!);
      } else {
        for (const namespace of templateNamespaces(item)) {
          if (namespace === '*') unrestricted = true;
          else namespaces.add(namespace);
        }
      }
    }

    return {
      automatic,
      manual,
      namespaces: namespaces.size,
      targets,
      total: items?.length || 0,
      unrestricted,
    };
  }, [items]);

  if (namespacedError && globalError) {
    return (
      <SectionBox title="Templates">
        <Alert severity="error">
          BreakRequestTemplates and GlobalBreakRequestTemplates are unavailable. Grant this account
          list access to at least one template API.
        </Alert>
      </SectionBox>
    );
  }

  return (
    <>
      {(namespacedError || globalError) && (
        <Box sx={{ px: { xs: 0, sm: 2 }, pt: 3 }}>
          <Alert severity="info">
            {namespacedError
              ? 'Namespaced BreakRequestTemplates could not be listed. Global templates returned by the readable API remain visible.'
              : 'GlobalBreakRequestTemplates could not be listed. Namespaced templates returned by the readable API remain visible.'}
          </Alert>
        </Box>
      )}
      <SummaryCardGrid columns={3} marginBottom={2} inset>
        <StatCard
          label="TEMPLATES"
          total={summary.total}
          segments={[
            { name: 'Manual approval', value: summary.manual, color: '#ed6c02' },
            { name: 'Automatic approval', value: summary.automatic, color: '#2e7d32' },
          ]}
          chips={[
            { label: `${summary.manual} Manual`, color: 'warning' },
            { label: `${summary.automatic} Automatic`, color: 'success' },
          ]}
        />
        <StatCard
          label="RENDER TARGETS"
          total={summary.targets}
          segments={[{ name: 'Targets', value: summary.targets, color: '#1976d2' }]}
          chips={[{ label: `${summary.targets} Targets`, color: 'primary' }]}
        />
        <StatCard
          label="NAMESPACES"
          total={summary.namespaces}
          segments={[{ name: 'Namespaces', value: summary.namespaces, color: '#7b1fa2' }]}
          chips={[
            {
              label: summary.unrestricted ? 'All Namespaces' : `${summary.namespaces} Visible`,
              color: 'info',
            },
          ]}
        />
      </SummaryCardGrid>

      <ResourceListView
        id="capsule-break-request-templates"
        title="Templates"
        data={items}
        headerProps={anchoredResourceListHeaderProps('Templates', {
          headerProps: { noNamespaceFilter: false },
        })}
        defaultSortingColumn={{ id: 'name', desc: false }}
        enableRowActions
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                <BreakRequestTemplateIcon template={item} size={22} />
                <CapsuleResourceLink
                  crd={
                    item.getNamespace()
                      ? CAPSULE_CRDS.BreakRequestTemplate
                      : CAPSULE_CRDS.GlobalBreakRequestTemplate
                  }
                  name={item.getName()}
                  namespace={item.getNamespace()}
                >
                  {item.getName()}
                </CapsuleResourceLink>
              </Box>
            ),
          },
          {
            id: 'scope',
            label: 'Scope',
            getValue: item => (item.getNamespace() ? 'Namespaced' : 'Global'),
            render: item => (
              <Chip
                color={item.getNamespace() ? 'secondary' : 'info'}
                label={item.getNamespace() ? 'Namespaced' : 'Global'}
                size="small"
                variant="outlined"
              />
            ),
            filterVariant: 'select',
          },
          {
            id: 'availability',
            label: 'Namespace Availability',
            getValue: item => {
              const namespaces = item.getNamespace()
                ? [item.getNamespace()!]
                : templateNamespaces(item);
              return namespaces.includes('*') ? 'All Namespaces' : namespaces.join(' ');
            },
            render: item => {
              if (item.getNamespace()) return item.getNamespace();
              const namespaces = templateNamespaces(item);
              if (namespaces.includes('*')) return 'All Namespaces';
              return namespaces.length ? `${namespaces.length} Namespaces` : 'Not reported';
            },
          },
          {
            id: 'description',
            label: 'Description',
            getValue: item => breakRequestTemplateDescription(item) || '',
            render: item => (
              <Typography
                color={breakRequestTemplateDescription(item) ? 'text.primary' : 'text.secondary'}
                variant="body2"
                sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}
                noWrap
              >
                {breakRequestTemplateDescription(item) || 'No description provided.'}
              </Typography>
            ),
          },
          {
            id: 'approval',
            label: 'Approval',
            getValue: item => templateApprovalMode(item),
            render: item => {
              const mode = templateApprovalMode(item);
              return (
                <Chip
                  size="small"
                  label={mode}
                  color={mode === 'Automatic' ? 'success' : 'warning'}
                />
              );
            },
            filterVariant: 'select',
          },
          'age',
        ]}
      />
    </>
  );
}

export default BreakRequestTemplatesList;
