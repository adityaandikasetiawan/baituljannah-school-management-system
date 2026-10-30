import { pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, jsonb, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";

export const unitStatus = pgEnum("unit_status", ["active", "inactive", "archived"]);
export const userStatus = pgEnum("user_status", ["invited", "active", "suspended"]);
export const siteStatus = pgEnum("site_status", ["draft", "published", "suspended"]);

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
