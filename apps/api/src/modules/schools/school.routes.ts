import { Router } from "express";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { auditLogs, organizations, schoolSites, schoolUnits } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";
import type { AccessContext } from "../access/tenant-access.js";

export const schoolRouter = Router();
const updateSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/).optional(),
  name: z.string().trim().min(2).max(180).optional(),
  level: z.enum(["TK", "SD", "SMP", "SMA", "SLB"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");
const statusSchema = z.object({ status: z.enum(["active", "inactive", "archived"]) });
const createSchema = z.object({
  organizationId: z.uuid().optional(),
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(180),
  level: z.enum(["TK", "SD", "SMP", "SMA", "SLB"]),
});
schoolRouter.use(authenticate, loadAccessContext);
schoolRouter.get("/accessible", async (_req, res, next) => {
  try {
    const context = res.locals.accessContext as AccessContext;
    if (context.globalPermissions.includes("school.read")) {
      const rows = await db.select().from(schoolUnits);
      res.json({ data: rows });
      return;
    }
    const schoolIds = context.schoolMemberships
      .filter((membership) => membership.permissions.includes("school.read"))
      .map((membership) => membership.schoolId);
    if (schoolIds.length === 0) { res.json({ data: [] }); return; }
    const rows = await db.select().from(schoolUnits).where(inArray(schoolUnits.id, schoolIds));
    res.json({ data: rows });
  } catch (error) { next(error); }
});
schoolRouter.get("/", requirePermission("school.read"), async (req, res, next) => {
  try {
    const context = res.locals.accessContext as AccessContext;
    const rows = context.globalPermissions.includes("school.read")
      ? await db.select().from(schoolUnits)
      : await db.select().from(schoolUnits).where(eq(schoolUnits.id, req.schoolId!));
    res.json({ data: rows });
  } catch (error) { next(error); }
});
schoolRouter.patch("/:schoolId", requirePermission("school.manage"), async (req, res, next) => {
  const id = z.uuid().safeParse(req.params.schoolId);
  const parsed = updateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "ID atau data school unit tidak valid." } });
    return;
  }
  const context = res.locals.accessContext as AccessContext;
  if (!context.globalPermissions.includes("school.manage") && req.schoolId !== id.data) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Anda hanya dapat mengubah unit sekolah yang menjadi kewenangan Anda." } });
    return;
  }
  try {
    const current = await db.query.schoolUnits.findFirst({ where: eq(schoolUnits.id, id.data) });
    if (!current) { res.status(404).json({ error: { code: "SCHOOL_NOT_FOUND", message: "School unit tidak ditemukan." } }); return; }
    if (current.status === "archived") { res.status(409).json({ error: { code: "SCHOOL_ARCHIVED", message: "School unit yang sudah diarsipkan tidak dapat diubah." } }); return; }
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(schoolUnits).set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(schoolUnits.id, id.data)).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId: id.data, action: "school_unit.updated", entityType: "school_unit", entityId: id.data, metadata: parsed.data });
      return rows;
    });
    res.json({ data: updated });
  } catch (error) { next(error); }
});

schoolRouter.patch("/:schoolId/status", requirePermission("school.manage"), async (req, res, next) => {
  const id = z.uuid().safeParse(req.params.schoolId);
  const parsed = statusSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Status school unit tidak valid." } });
    return;
  }
  const context = res.locals.accessContext as AccessContext;
  if (!context.globalPermissions.includes("school.manage") && req.schoolId !== id.data) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Anda hanya dapat mengubah status unit sekolah yang menjadi kewenangan Anda." } });
    return;
  }
  try {
    const current = await db.query.schoolUnits.findFirst({ where: eq(schoolUnits.id, id.data) });
    if (!current) { res.status(404).json({ error: { code: "SCHOOL_NOT_FOUND", message: "School unit tidak ditemukan." } }); return; }
    if (current.status === "archived" && parsed.data.status !== "archived") {
      res.status(409).json({ error: { code: "SCHOOL_ARCHIVED", message: "School unit yang sudah diarsipkan tidak dapat diaktifkan kembali." } });
      return;
    }
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(schoolUnits).set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(schoolUnits.id, id.data)).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId: id.data, action: "school_unit.status_changed", entityType: "school_unit", entityId: id.data, metadata: parsed.data });
      return rows;
    });
    res.json({ data: updated });
  } catch (error) { next(error); }
});

schoolRouter.post("/", requirePermission("school.manage"), async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid school-unit payload", details: parsed.error.flatten() } }); return; }
  try {
    const organization = parsed.data.organizationId
      ? await db.query.organizations.findFirst({ where: eq(organizations.id, parsed.data.organizationId) })
      : await db.query.organizations.findFirst({ where: eq(organizations.name, "Yayasan Baituljannah") });
    if (!organization) { res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization was not found. Run the initial database seed first." } }); return; }
    const created = await db.transaction(async (tx) => {
      const [unit] = await tx.insert(schoolUnits).values({ ...parsed.data, organizationId: organization.id }).returning();
      if (!unit) throw new Error("School unit insert returned no row");
      const [site] = await tx.insert(schoolSites).values({ schoolId: unit.id, title: unit.name, status: "draft" }).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId: unit.id, action: "school_unit.created", entityType: "school_unit", entityId: unit.id, metadata: { code: unit.code, siteId: site?.id } });
      return { unit, site };
    });
    res.status(201).json({ data: created });
  } catch (error) { next(error); }
});
