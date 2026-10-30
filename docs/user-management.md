# User management

The user-management API is scoped to one school unit per request. Clients must send `x-school-id`; the backend authorizes that school against the authenticated user's global permissions or school membership before handlers run.

## Endpoints

- `GET /api/v1/users/roles` — school-scoped role catalog.
- `GET /api/v1/users` — users assigned to the selected school unit.
- `POST /api/v1/users` — create an active user and assign one school role in a single transaction.
- `POST /api/v1/users/assign-existing` — assign an existing global account to the selected school unit with a school-scoped role.
- `GET /api/v1/school-units/accessible` — list units visible to the current user without exposing other tenants.
- `PATCH /api/v1/users/:userId` — update full name and/or account status, only when the user belongs to the selected school.

All endpoints require a bearer access token and `user.manage`. The initial password must be at least 12 characters. Global roles and personal roles cannot be assigned through this API. Every create/update action writes an audit log. Password hashes are never returned.

An email address is globally unique: an existing user cannot be silently duplicated into another school. Multi-school assignment and invitations/password-reset flows are separate follow-up capabilities and must be implemented with explicit audit trails.
