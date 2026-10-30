import { pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, jsonb, uniqueIndex, index, primaryKey, date } from "drizzle-orm/pg-core";

export const unitStatus = pgEnum("unit_status", ["active", "inactive", "archived"]);
export const userStatus = pgEnum("user_status", ["invited", "active", "suspended"]);
export const siteStatus = pgEnum("site_status", ["draft", "published", "suspended"]);
export const studentRecordStatus = pgEnum("student_record_status", ["active", "inactive", "archived"]);
export const enrollmentStatus = pgEnum("enrollment_status", ["candidate", "active", "graduated", "transferred", "withdrawn"]);
export const academicYearStatus = pgEnum("academic_year_status", ["draft", "active", "closed"]);
export const attendanceSessionStatus = pgEnum("attendance_session_status", ["draft", "submitted", "locked"]);
export const attendanceRecordStatus = pgEnum("attendance_record_status", ["unmarked", "present", "absent", "late", "sick", "permission"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  legalName: varchar("legal_name", { length: 220 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const schoolUnits = pgTable("school_units", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  level: varchar("level", { length: 24 }).notNull(),
  status: unitStatus("status").default("active").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Jakarta").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("school_units_org_code_uq").on(t.organizationId, t.code), index("school_units_org_idx").on(t.organizationId)]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 254 }).notNull(),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  status: userStatus("status").default("invited").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("users_email_lower_uq").on(t.email)]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  scope: varchar("scope", { length: 16 }).notNull(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]);

export const userSchoolRoles = pgTable("user_school_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  assignedBy: uuid("assigned_by").references(() => users.id),
}, (t) => [primaryKey({ columns: [t.userId, t.schoolId, t.roleId] }), index("user_school_roles_school_idx").on(t.schoolId)]);

export const globalUserRoles = pgTable("global_user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id),
}, (t) => [primaryKey({ columns: [t.userId, t.roleId] })]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("auth_sessions_user_idx").on(t.userId)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  schoolId: uuid("school_id").references(() => schoolUnits.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("audit_logs_school_created_idx").on(t.schoolId, t.createdAt)]);

// CMS foundation: versioned structured content rendered only by trusted UI components.
export const siteTemplates = pgTable("site_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 140 }).notNull(),
  schemaVersion: varchar("schema_version", { length: 24 }).notNull(),
  definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const schoolSites = pgTable("school_sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }).unique(),
  templateId: uuid("template_id").references(() => siteTemplates.id),
  title: varchar("title", { length: 180 }).notNull(),
  status: siteStatus("status").default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const siteDomains = pgTable("site_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => schoolSites.id, { onDelete: "cascade" }),
  hostname: varchar("hostname", { length: 253 }).notNull().unique(),
  verificationToken: varchar("verification_token", { length: 128 }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  isPrimary: boolean("is_primary").default(false).notNull(),
});

export const sitePages = pgTable("site_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => schoolSites.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 180 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  isHome: boolean("is_home").default(false).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("site_pages_site_slug_uq").on(t.siteId, t.slug)]);

export const sitePageVersions = pgTable("site_page_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id").notNull().references(() => sitePages.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 32 }).notNull(),
  document: jsonb("document").$type<Record<string, unknown>>().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("site_page_versions_page_version_uq").on(t.pageId, t.version)]);

export const sitePublications = pgTable("site_publications", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => schoolSites.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").notNull().references(() => sitePages.id, { onDelete: "cascade" }),
  pageVersionId: uuid("page_version_id").notNull().references(() => sitePageVersions.id),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  publishedBy: uuid("published_by").references(() => users.id),
}, (t) => [index("site_publications_site_idx").on(t.siteId, t.publishedAt)]);

export const siteAssets = pgTable("site_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => schoolSites.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: varchar("size_bytes", { length: 24 }).notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


// Student master data is organization-scoped; school/year participation is stored in enrollments.
export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  nisn: varchar("nisn", { length: 10 }),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  preferredName: varchar("preferred_name", { length: 100 }),
  gender: varchar("gender", { length: 16 }).notNull(),
  birthPlace: varchar("birth_place", { length: 120 }),
  birthDate: date("birth_date", { mode: "string" }),
  address: text("address"),
  recordStatus: studentRecordStatus("record_status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("students_nisn_uq").on(t.nisn), index("students_org_name_idx").on(t.organizationId, t.fullName)]);

export const academicYears = pgTable("academic_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 9 }).notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: academicYearStatus("status").default("draft").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("academic_year_school_label_uq").on(t.schoolId, t.label), index("academic_year_school_current_idx").on(t.schoolId, t.isCurrent)]);

export const classGroups = pgTable("class_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  gradeLabel: varchar("grade_label", { length: 40 }).notNull(),
  homeroomTeacherId: uuid("homeroom_teacher_id").references(() => users.id),
  capacity: varchar("capacity", { length: 4 }).default("36").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("class_group_year_code_uq").on(t.academicYearId, t.code), index("class_group_school_year_idx").on(t.schoolId, t.academicYearId)]);

export const subjects = pgTable("subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 140 }).notNull(),
  gradeLevel: varchar("grade_level", { length: 40 }),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("subjects_school_code_uq").on(t.schoolId, t.code)]);

export const classSubjects = pgTable("class_subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  classGroupId: uuid("class_group_id").notNull().references(() => classGroups.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("class_subject_pair_uq").on(t.classGroupId, t.subjectId)]);

export const studentEnrollments = pgTable("student_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }),
  classGroupId: uuid("class_group_id").references(() => classGroups.id),
  admissionNumber: varchar("admission_number", { length: 40 }).notNull(),
  academicYear: varchar("academic_year", { length: 9 }).notNull(),
  gradeLabel: varchar("grade_label", { length: 40 }).notNull(),
  status: enrollmentStatus("status").default("active").notNull(),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("student_enrollment_school_admission_uq").on(t.schoolId, t.admissionNumber),
  uniqueIndex("student_enrollment_school_year_uq").on(t.schoolId, t.studentId, t.academicYear),
  index("student_enrollment_school_status_idx").on(t.schoolId, t.status),
]);

export const studentGuardians = pgTable("student_guardians", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  relationship: varchar("relationship", { length: 40 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 254 }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  canPickup: boolean("can_pickup").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("student_guardians_student_idx").on(t.studentId)]);

export const attendanceSessions = pgTable("attendance_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolUnits.id, { onDelete: "cascade" }),
  classGroupId: uuid("class_group_id").notNull().references(() => classGroups.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").references(() => subjects.id),
  sessionDate: date("session_date", { mode: "string" }).notNull(),
  status: attendanceSessionStatus("status").default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("attendance_session_class_date_subject_uq").on(t.classGroupId, t.sessionDate, t.subjectId), index("attendance_session_school_date_idx").on(t.schoolId, t.sessionDate)]);

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status: attendanceRecordStatus("status").default("unmarked").notNull(),
  note: varchar("note", { length: 500 }),
  markedBy: uuid("marked_by").references(() => users.id),
  markedAt: timestamp("marked_at", { withTimezone: true }),
}, (t) => [uniqueIndex("attendance_record_session_student_uq").on(t.sessionId, t.studentId), index("attendance_record_student_idx").on(t.studentId)]);
