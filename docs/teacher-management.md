# Teacher management

Teacher accounts are created through User Management with the school-scoped `teacher` role. Teacher profiles add school employment information to that existing account.

- `GET /api/v1/teachers` — list teacher profiles in the selected school.
- `POST /api/v1/teachers` — create a profile for an existing user with a `teacher` role in the selected school.
- `PATCH /api/v1/teachers/:profileId` — update employee number, job title, specialization, hire date, and employment status.

Teacher profiles are school-scoped. Academic class and subject assignment APIs reference the same teacher user identity.
