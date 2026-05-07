export const FRONTDESK_WORKSPACE_COOKIE = 'frontdesk_workspace_tenant_id';
export const FRONTDESK_TENANT_HEADER = 'x-frontdesk-tenant-id';
export const PRIVATE_SALES_WORKSPACE_SLUG = 'aatif-sales';
export const DEMO_WORKSPACE_SLUG = 'skybridge-demo';

export type WorkspaceLabel = 'Demo Workspace' | 'Private Sales Workspace' | 'Workspace';

export function workspaceLabelFromSlug(slug: string): WorkspaceLabel {
  if (slug === DEMO_WORKSPACE_SLUG) {
    return 'Demo Workspace';
  }

  if (slug === PRIVATE_SALES_WORKSPACE_SLUG) {
    return 'Private Sales Workspace';
  }

  return 'Workspace';
}

export function isPrivateSalesWorkspaceSlug(slug: string | null | undefined) {
  return slug === PRIVATE_SALES_WORKSPACE_SLUG;
}
