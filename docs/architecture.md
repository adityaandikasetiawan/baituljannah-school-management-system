# Architecture decisions

## Foundation
1. Modular monolith: one API deployment and one relational database, with domain modules separated by folders.
2. Central tenancy: every unit-owned operational record carries a non-null `school_id`. Foundation-wide records are explicitly global.
3. Identity vs enrollment: student identity is a future foundation-wide person record; school/year participation belongs in enrollment history.
4. Authorization: permissions are checked on the server; hiding UI menus is not authorization.
5. CMS publishing: drafts and immutable page versions are separate from the live publication pointer. Content is validated JSON rendered through trusted components.
6. Manual finance: verified payment records will be append-only; corrections use reversals/adjustments.
7. Curriculum and grading rules are configurable by school level and academic year.

## Initial units
Baseline units: IT-TK, IT-SD, IT-SMP, IT-SMA, IT-SLB Baituljannah. They are not hardcoded as tenant IDs; controlled provisioning creates them.

## Request flow
Web -> API authentication -> permission check -> resolve active school membership -> tenant-scoped service -> PostgreSQL. Public website reads use a separate publication path and never expose private SMIS records.

## Extension points
Academic calendar, admissions, student master, guardian relationships, class/subject scheduling, attendance, assessment, manual invoicing/payment allocation, notification, reporting, and CMS drag-and-drop editor.
