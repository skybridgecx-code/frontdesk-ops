import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_WORKSPACE_SLUG,
  PRIVATE_SALES_WORKSPACE_SLUG,
  isPrivateSalesWorkspaceSlug,
  workspaceLabelFromSlug
} from './workspace';

test('workspace labels map known slugs correctly', () => {
  assert.equal(workspaceLabelFromSlug(DEMO_WORKSPACE_SLUG), 'Demo Workspace');
  assert.equal(workspaceLabelFromSlug(PRIVATE_SALES_WORKSPACE_SLUG), 'Private Sales Workspace');
  assert.equal(workspaceLabelFromSlug('customer-tenant'), 'Workspace');
});

test('private sales workspace check is strict', () => {
  assert.equal(isPrivateSalesWorkspaceSlug(PRIVATE_SALES_WORKSPACE_SLUG), true);
  assert.equal(isPrivateSalesWorkspaceSlug(DEMO_WORKSPACE_SLUG), false);
  assert.equal(isPrivateSalesWorkspaceSlug('customer-tenant'), false);
  assert.equal(isPrivateSalesWorkspaceSlug(null), false);
});
