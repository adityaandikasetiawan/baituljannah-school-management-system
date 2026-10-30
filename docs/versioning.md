# Versioning and release policy

## 1. Application version
The workspace follows Semantic Versioning: `MAJOR.MINOR.PATCH`.

- MAJOR: incompatible changes to supported contracts or data migration requirements.
- MINOR: backward-compatible features.
- PATCH: backward-compatible bug fixes and security fixes.

The root package, API package, web package, `version.json`, API metadata, and web UI version constant must match. Run `pnpm version:check` before committing a release. CI enforces the same check.

## 2. Git and release history
- Use Conventional Commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `security:`.
- Create a release tag in the form `vMAJOR.MINOR.PATCH`, for example `v0.2.0`.
- Push the tag to GitHub. The release workflow creates a GitHub Release and uses the matching section from `CHANGELOG.md`.
- Do not overwrite an existing release tag. Corrections require a new patch version.

## 3. API versioning
All supported API routes are grouped under `/api/v1`. Add `/api/v2` only for a breaking contract change. Keep old versions available during a documented deprecation window. The `GET /api/v1/meta` endpoint returns the app and API version.

## 4. Database schema versioning
Drizzle Kit owns schema migrations. Generate migrations from schema changes with `pnpm db:generate`; review the generated SQL before applying it with `pnpm db:migrate`. Commit every migration under `apps/api/drizzle/`. Never edit an already-applied migration; create a new forward migration instead. Back up production data before applying migrations. Use expand-and-contract changes for columns or constraints that need a safe rollout.

The migration journal and Drizzle migration table are the database migration history. `version.json.schemaVersion` is a human-facing baseline marker, not a substitute for the migration journal.

## 5. CMS content versioning
Each saved page revision is an immutable row in `site_page_versions`. Publishing creates a publication record pointing to an exact page version. Rollback means publishing a prior immutable version, not overwriting its JSON document. Every save/publish/rollback operation must record actor, timestamp, page, and school unit.

## 6. Release checklist
1. Update all version fields consistently.
2. Add a dated `CHANGELOG.md` section.
3. Run `pnpm version:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
4. Review and commit database migrations.
5. Merge the release commit to `main`.
6. Create and push tag `vX.Y.Z`.
7. Verify the GitHub Release and CI run.
