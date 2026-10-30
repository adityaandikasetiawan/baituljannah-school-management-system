# Academic management

Academic configuration is isolated by school unit and requires the `academic.manage` permission.

- `GET/POST /api/v1/academic/years` — list and create academic years; a school can have one current year.
- `GET/POST /api/v1/academic/classes` — list and create class groups within a school academic year.
- `GET/POST /api/v1/academic/subjects` — manage school subjects.
- `POST /api/v1/academic/classes/:classId/subjects` — assign a subject and optional teacher to a class.

Student enrollment-to-class placement, attendance calendars, timetables, and grading policies are planned as the next academic submodules.
