# Changelog

All notable changes to this project are documented here.

The format follows Keep a Changelog and the project uses Semantic Versioning.

## [0.2.0] - 2026-10-30

### Added
- Establish a shared application version across the workspace.
- Add API metadata endpoint exposing application and API versions.
- Add version information to the web administration shell.
- Add version consistency validation to CI.
- Define release, database migration, API, and CMS content versioning policies.
- Add a GitHub Actions workflow for creating releases from version tags.

### Changed
- Align root, API, and web package versions at 0.2.0.

## [0.1.0] - 2026-10-30

### Added
- Initial modular-monolith workspace and administration shell.
- PostgreSQL and Drizzle schema foundation.
- JWT authentication and role/permission primitives.
- Central school-unit and CMS data foundations.
- Initial CI workflow and architecture documentation.
