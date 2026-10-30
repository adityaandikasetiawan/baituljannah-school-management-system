# Baituljannah School Management System

Centralized multi-school management platform for Baituljannah.

## Foundation scope
This increment establishes the workspace, React administration shell, Node.js API, PostgreSQL/Drizzle schema, authentication, role/permission catalog, tenant access primitives, CMS data foundation, documentation, and CI. Academic workflows, finance operations, the drag-and-drop editor, and production deployment are later increments.

## Architecture
- Modular monolith: one API and one PostgreSQL database.
- Web: React + TypeScript + Vite + Ant Design.
- API: Node.js + Express + TypeScript + Zod.
- Data: PostgreSQL + Drizzle ORM.
- Tests: Vitest.
- Tenant isolation: school-owned records carry `school_id`; server-side access derives from memberships, never from client input alone.
- CMS content uses versioned JSON documents rendered through trusted components; arbitrary scripts are not allowed.

## Requirements
Node.js 22+, pnpm 10+, PostgreSQL 15+.

## Local setup
1. Copy `.env.example` to `apps/api/.env`; replace the JWT secret with a unique random secret.
2. Create PostgreSQL database `baituljannah`.
3. Run `pnpm install`.
4. Run `pnpm db:generate && pnpm db:migrate`.
5. Run `pnpm db:seed` to create role and permission catalog entries.
6. Run `pnpm dev`. API: `http://localhost:4000/health`; web: `http://localhost:5173`.

The seed does not create a default administrator or predictable password. A controlled one-time administrator bootstrap is required before real use.

## Quality checks
`pnpm typecheck`, `pnpm test`, `pnpm build`.

See `docs/` for architecture, security, development, and test strategy. This is a development foundation, not a production security certification.
