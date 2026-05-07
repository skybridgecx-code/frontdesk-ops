# Workspace Separation

This project supports two explicit tenant workspaces for the same Clerk user:

- `skybridge-demo` => **Demo Workspace**
- `aatif-sales` => **Private Sales Workspace**

## Bootstrap both workspaces

Run this once per environment to ensure both tenants exist and your Clerk user is attached to both:

```bash
cd /Users/muhammadaatif/frontdesk-os
WORKSPACE_BOOTSTRAP_CONFIRM=workspace-bootstrap CLERK_USER_ID=<your_clerk_user_id> pnpm --filter @frontdesk/db bootstrap:workspaces
```

## Optional acquisition lead migration

If acquisition leads were previously imported into `skybridge-demo`, copy them into `aatif-sales` with:

```bash
cd /Users/muhammadaatif/frontdesk-os
MIGRATE_ACQUISITION_CONFIRM=aatif-sales pnpm --filter @frontdesk/db migrate:acquisition:to-private
```

Notes:

- Migration is additive and deduplicates by website first, then business+location.
- It does not delete source records from `skybridge-demo`.
- Review output counts before and after running.
