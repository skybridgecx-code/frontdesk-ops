export const FRONTDESK_WORKSPACE_COOKIE = 'frontdesk_workspace_tenant_id';
export const FRONTDESK_TENANT_HEADER = 'x-frontdesk-tenant-id';

export type WorkspaceLabel = 'Demo Workspace' | 'Private Sales Workspace' | 'Workspace';

export function workspaceLabelFromSlug(slug: string): WorkspaceLabel {
  if (slug === 'skybridge-demo') {
    return 'Demo Workspace';
  }

  if (slug === 'aatif-sales') {
    return 'Private Sales Workspace';
  }

  return 'Workspace';
}
