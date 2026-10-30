# Attendance management

Attendance sessions are created for a class and date, optionally linked to a class subject. Active student enrollments in the class are snapshotted into attendance records with an initial `unmarked` state.

- `GET /api/v1/attendance/classes` — current-year class groups available to the authenticated school user.
- `GET /api/v1/attendance/sessions` — list sessions by date and/or class.
- `POST /api/v1/attendance/sessions` — create a draft session and its student records.
- `GET /api/v1/attendance/sessions/:sessionId` — read session and roster.
- `PUT /api/v1/attendance/sessions/:sessionId/records` — upsert attendance statuses while the session is draft.
- `POST /api/v1/attendance/sessions/:sessionId/submit` — submit the session after every student has a final status.

Statuses: present, absent, late, sick, permission. Submitted sessions are immutable in the current workflow; correction/approval and attendance summaries are later enhancements.
