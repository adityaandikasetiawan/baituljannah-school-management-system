# School unit management

- Create: `POST /api/v1/school-units` creates the unit and its initial website draft in one transaction.
- Update: `PATCH /api/v1/school-units/:schoolId` updates code, name, or education level.
- Status: `PATCH /api/v1/school-units/:schoolId/status` changes the unit to active, inactive, or archived.
- Archived units are terminal: they cannot be edited or reactivated through the API. All update and status changes create audit log entries.
- `GET /api/v1/school-units/accessible` returns only units visible to the authenticated user.
