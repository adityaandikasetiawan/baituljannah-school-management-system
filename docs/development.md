# Development guide

Requirements: Node.js 22+, pnpm 10+, PostgreSQL 15+.

1. Copy root `.env.example` to `apps/api/.env`.
2. Set a unique random `JWT_ACCESS_SECRET` (at least 32 characters).
3. Create the PostgreSQL database `baituljannah`.
4. Run `pnpm install`.
5. Run `pnpm db:generate && pnpm db:migrate`.
6. Run `pnpm db:seed` to insert system roles and permissions.
7. Run `pnpm dev`.

Commands: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`.

No default administrator is seeded. Add a controlled one-time administrator bootstrap/invitation workflow before real use. Review generated migrations before applying them to shared environments.


## Initial administrator bootstrap
After applying the schema and running `pnpm db:seed`, set the following variables temporarily in `apps/api/.env`:
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PASSWORD` (minimum 14 characters)

Run `pnpm --filter @baituljannah/api admin:bootstrap` once. The command creates an active user and assigns the global Super Admin role only if no Super Admin assignment exists yet. It refuses to create a second initial Super Admin. Remove the bootstrap password from the environment immediately after the command completes.

The web login uses a short-lived access token stored in session storage. Refresh-token rotation and account recovery are not implemented yet; do not expose the app publicly until those flows and production security controls are completed.
