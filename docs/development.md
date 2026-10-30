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
