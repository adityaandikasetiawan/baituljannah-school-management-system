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
