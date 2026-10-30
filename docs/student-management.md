# Student management

Student identity is organization-scoped, while school participation is recorded as a separate enrollment for each school and academic year. The API requires a selected school context and server-side `student.read` or `student.manage` permission.

- `GET /api/v1/students` — paginated list with name, admission-number, NISN, and enrollment-status filters.
- `POST /api/v1/students` — create student identity, school enrollment, and optional guardian records in one transaction.
- `GET /api/v1/students/:studentId` — read student and guardian data only when enrolled in the selected unit.
- `PATCH /api/v1/students/:studentId` — update student master data.
- `PATCH /api/v1/students/:studentId/enrollment` — update enrollment details and lifecycle status.
- `POST /api/v1/students/:studentId/guardians` — add a guardian.

The schema supports a student identity shared across units without duplicating the master identity. Class placement, academic calendar, and full guardian portal account linking are subsequent academic-management work.
