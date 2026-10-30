# Test strategy

- Unit tests: tenant access decisions, validation, and permission behavior.
- API integration tests: authentication and authorization using an isolated database.
- Frontend tests: application shell and critical forms.
- End-to-end tests: add Playwright coverage when the first complete business workflow is available.

The first automated tests focus on the high-risk invariant that a user cannot access a school unit without explicit membership or a global permission.
