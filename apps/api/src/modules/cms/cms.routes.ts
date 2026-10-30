import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs, schoolSites, schoolUnits, sitePages, sitePageVersions, sitePublications, siteTemplates } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { cmsSlugSchema, cmsCreatePageSchema, cmsSavePageSchema } from "./cms.schemas.js";

export const cmsRouter = Router();
function selectedSchool(req: Request, res: Response): string | null {
  if (!req.schoolId) {
    res.status(400).json({ error: { code: "SCHOOL_CONTEXT_REQUIRED", message: "Pilih school unit melalui header x-school-id terlebih dahulu." } });
    return null;
  }
  return req.schoolId;
}
async function findSite(schoolId: string) {
  return db.query.schoolSites.findFirst({ where: eq(schoolSites.schoolId, schoolId) });
}
cmsRouter.get("/templates", authenticate, loadAccessContext, requirePermission("website.manage"), async (_req, res, next) => {
  try {
    const rows = await db.select({ id: siteTemplates.id, code: siteTemplates.code, name: siteTemplates.name, schemaVersion: siteTemplates.schemaVersion, definition: siteTemplates.definition })
      .from(siteTemplates).where(eq(siteTemplates.isActive, true));
    res.json({ data: rows });
  } catch (error) { next(error); }
});
cmsRouter.patch("/site/template", authenticate, loadAccessContext, requirePermission("website.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const parsed = z.object({ templateId: z.uuid() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Template tidak valid." } }); return; }
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website tidak ditemukan." } }); return; }
    const template = await db.query.siteTemplates.findFirst({ where: and(eq(siteTemplates.id, parsed.data.templateId), eq(siteTemplates.isActive, true)) });
    if (!template) { res.status(404).json({ error: { code: "TEMPLATE_NOT_FOUND", message: "Template aktif tidak ditemukan." } }); return; }
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(schoolSites).set({ templateId: template.id, updatedAt: new Date() }).where(eq(schoolSites.id, site.id)).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "cms.template_changed", entityType: "school_site", entityId: site.id, metadata: { templateId: template.id, templateCode: template.code } });
      return rows;
    });
    res.json({ data: { site: updated, template } });
  } catch (error) { next(error); }
});
cmsRouter.get("/site", authenticate, loadAccessContext, requirePermission("website.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website untuk unit ini belum tersedia." } }); return; }
    const pages = await db.select({
      id: sitePages.id, title: sitePages.title, slug: sitePages.slug, isHome: sitePages.isHome, isPublished: sitePages.isPublished, updatedAt: sitePages.updatedAt,
    }).from(sitePages).where(eq(sitePages.siteId, site.id)).orderBy(sitePages.isHome, sitePages.title);
    res.json({ data: { site, pages } });
  } catch (error) { next(error); }
});
cmsRouter.post("/pages", authenticate, loadAccessContext, requirePermission("website.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const parsed = cmsCreatePageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Data halaman tidak valid.", details: parsed.error.flatten() } }); return; }
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website belum tersedia." } }); return; }
    const existing = await db.query.sitePages.findFirst({ where: and(eq(sitePages.siteId, site.id), eq(sitePages.slug, parsed.data.slug)) });
    if (existing) { res.status(409).json({ error: { code: "SLUG_ALREADY_EXISTS", message: "Slug halaman sudah digunakan." } }); return; }
    const created = await db.transaction(async (tx) => {
      if (parsed.data.isHome) await tx.update(sitePages).set({ isHome: false }).where(eq(sitePages.siteId, site.id));
      const [page] = await tx.insert(sitePages).values({ siteId: site.id, ...parsed.data }).returning();
      if (!page) throw new Error("Page insert returned no row");
      const initialDocument = { schemaVersion: "1.0", blocks: [{ id: "welcome", type: "hero", title: page.title, subtitle: "Selamat datang di website resmi sekolah kami." }] };
      const [version] = await tx.insert(sitePageVersions).values({ pageId: page.id, version: "v1", document: initialDocument, createdBy: req.auth!.sub }).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "cms.page_created", entityType: "site_page", entityId: page.id, metadata: { slug: page.slug } });
      return { page, version };
    });
    res.status(201).json({ data: created });
  } catch (error) { next(error); }
});
cmsRouter.get("/pages/:pageId", authenticate, loadAccessContext, requirePermission("website.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const pageId = z.uuid().safeParse(req.params.pageId);
  if (!pageId.success) { res.status(400).json({ error: { code: "INVALID_PAGE_ID", message: "ID halaman tidak valid." } }); return; }
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website tidak ditemukan." } }); return; }
    const page = await db.query.sitePages.findFirst({ where: and(eq(sitePages.id, pageId.data), eq(sitePages.siteId, site.id)) });
    if (!page) { res.status(404).json({ error: { code: "PAGE_NOT_FOUND", message: "Halaman tidak ditemukan pada unit ini." } }); return; }
    const versions = await db.select().from(sitePageVersions).where(eq(sitePageVersions.pageId, page.id)).orderBy(desc(sitePageVersions.createdAt));
    res.json({ data: { page, version: versions[0] ?? null, versions } });
  } catch (error) { next(error); }
});
cmsRouter.put("/pages/:pageId", authenticate, loadAccessContext, requirePermission("website.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const pageId = z.uuid().safeParse(req.params.pageId);
  const parsed = cmsSavePageSchema.safeParse(req.body);
  if (!pageId.success || !parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "ID atau konten halaman tidak valid.", details: parsed.success ? undefined : parsed.error.flatten() } }); return; }
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website tidak ditemukan." } }); return; }
    const page = await db.query.sitePages.findFirst({ where: and(eq(sitePages.id, pageId.data), eq(sitePages.siteId, site.id)) });
    if (!page) { res.status(404).json({ error: { code: "PAGE_NOT_FOUND", message: "Halaman tidak ditemukan pada unit ini." } }); return; }
    const versions = await db.select().from(sitePageVersions).where(eq(sitePageVersions.pageId, page.id)).orderBy(desc(sitePageVersions.createdAt));
    const version = `v${Date.now()}`;
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(sitePageVersions).values({ pageId: page.id, version, document: parsed.data.document, createdBy: req.auth!.sub }).returning();
      await tx.update(sitePages).set({ updatedAt: new Date() }).where(eq(sitePages.id, page.id));
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "cms.page_saved", entityType: "site_page", entityId: page.id, metadata: { version } });
      return rows;
    });
    res.status(201).json({ data: created });
  } catch (error) { next(error); }
});
cmsRouter.post("/pages/:pageId/publish", authenticate, loadAccessContext, requirePermission("website.publish"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const pageId = z.uuid().safeParse(req.params.pageId);
  if (!pageId.success) { res.status(400).json({ error: { code: "INVALID_PAGE_ID", message: "ID halaman tidak valid." } }); return; }
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website tidak ditemukan." } }); return; }
    const page = await db.query.sitePages.findFirst({ where: and(eq(sitePages.id, pageId.data), eq(sitePages.siteId, site.id)) });
    if (!page) { res.status(404).json({ error: { code: "PAGE_NOT_FOUND", message: "Halaman tidak ditemukan pada unit ini." } }); return; }
    const [version] = await db.select().from(sitePageVersions).where(eq(sitePageVersions.pageId, page.id)).orderBy(desc(sitePageVersions.createdAt)).limit(1);
    if (!version) { res.status(409).json({ error: { code: "NO_PAGE_VERSION", message: "Simpan konten halaman sebelum melakukan publikasi." } }); return; }
    const publication = await db.transaction(async (tx) => {
      const [row] = await tx.insert(sitePublications).values({ siteId: site.id, pageId: page.id, pageVersionId: version.id, publishedBy: req.auth!.sub }).returning();
      await tx.update(sitePages).set({ isPublished: true, updatedAt: new Date() }).where(eq(sitePages.id, page.id));
      await tx.update(schoolSites).set({ status: "published", updatedAt: new Date() }).where(eq(schoolSites.id, site.id));
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "cms.page_published", entityType: "site_page", entityId: page.id, metadata: { versionId: version.id } });
      return row;
    });
    res.status(201).json({ data: { publication, page, version } });
  } catch (error) { next(error); }
});
cmsRouter.post("/pages/:pageId/rollback/:versionId", authenticate, loadAccessContext, requirePermission("website.publish"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const pageId = z.uuid().safeParse(req.params.pageId);
  const versionId = z.uuid().safeParse(req.params.versionId);
  if (!pageId.success || !versionId.success) { res.status(400).json({ error: { code: "INVALID_ID", message: "ID halaman atau versi tidak valid." } }); return; }
  try {
    const site = await findSite(schoolId);
    if (!site) { res.status(404).json({ error: { code: "SITE_NOT_FOUND", message: "Website tidak ditemukan." } }); return; }
    const page = await db.query.sitePages.findFirst({ where: and(eq(sitePages.id, pageId.data), eq(sitePages.siteId, site.id)) });
    if (!page) { res.status(404).json({ error: { code: "PAGE_NOT_FOUND", message: "Halaman tidak ditemukan." } }); return; }
    const version = await db.query.sitePageVersions.findFirst({ where: and(eq(sitePageVersions.id, versionId.data), eq(sitePageVersions.pageId, page.id)) });
    if (!version) { res.status(404).json({ error: { code: "VERSION_NOT_FOUND", message: "Versi halaman tidak ditemukan." } }); return; }
    const publication = await db.transaction(async (tx) => {
      const [row] = await tx.insert(sitePublications).values({ siteId: site.id, pageId: page.id, pageVersionId: version.id, publishedBy: req.auth!.sub }).returning();
      await tx.update(sitePages).set({ isPublished: true, updatedAt: new Date() }).where(eq(sitePages.id, page.id));
      await tx.update(schoolSites).set({ status: "published", updatedAt: new Date() }).where(eq(schoolSites.id, site.id));
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "cms.page_rolled_back", entityType: "site_page", entityId: page.id, metadata: { versionId: version.id } });
      return row;
    });
    res.status(201).json({ data: { publication, version } });
  } catch (error) { next(error); }
});
export const publicCmsRouter = Router();
publicCmsRouter.get("/schools/:schoolCode", async (req, res, next) => {
  const code = z.string().trim().min(2).max(32).transform((value) => value.toUpperCase()).safeParse(req.params.schoolCode);
  if (!code.success) { res.status(400).json({ error: { code: "INVALID_SCHOOL_CODE", message: "Kode sekolah tidak valid." } }); return; }
  try {
    const [site] = await db.select({
      siteId: schoolSites.id, siteTitle: schoolSites.title, schoolName: schoolUnits.name, schoolCode: schoolUnits.code,
    }).from(schoolUnits).innerJoin(schoolSites, eq(schoolSites.schoolId, schoolUnits.id))
      .where(and(eq(schoolUnits.code, code.data), eq(schoolUnits.status, "active"), eq(schoolSites.status, "published"))).limit(1);
    if (!site) { res.status(404).json({ error: { code: "PUBLIC_SITE_NOT_FOUND", message: "Website sekolah belum dipublikasikan." } }); return; }
    const publications = await db.select({
      pageId: sitePages.id, title: sitePages.title, slug: sitePages.slug, isHome: sitePages.isHome,
      version: sitePageVersions.version, publishedAt: sitePublications.publishedAt,
    }).from(sitePages).innerJoin(sitePublications, eq(sitePublications.pageId, sitePages.id))
      .innerJoin(sitePageVersions, eq(sitePageVersions.id, sitePublications.pageVersionId))
      .where(eq(sitePages.siteId, site.siteId)).orderBy(desc(sitePublications.publishedAt));
    const latestByPage = new Map<string, typeof publications[number]>();
    for (const item of publications) if (!latestByPage.has(item.pageId)) latestByPage.set(item.pageId, item);
    res.json({ data: { ...site, pages: [...latestByPage.values()].sort((a,b) => Number(b.isHome)-Number(a.isHome) || a.title.localeCompare(b.title)) } });
  } catch (error) { next(error); }
});

publicCmsRouter.get("/schools/:schoolCode/pages/:slug", async (req, res, next) => {
  const code = z.string().trim().min(2).max(32).transform((value) => value.toUpperCase()).safeParse(req.params.schoolCode);
  const slug = cmsSlugSchema.safeParse(req.params.slug);
  if (!code.success || !slug.success) { res.status(400).json({ error: { code: "INVALID_ROUTE", message: "Alamat halaman tidak valid." } }); return; }
  try {
    const [result] = await db.select({
      pageId: sitePages.id, title: sitePages.title, slug: sitePages.slug,
      isHome: sitePages.isHome, version: sitePageVersions.version,
      document: sitePageVersions.document, publishedAt: sitePublications.publishedAt,
      siteTitle: schoolSites.title, schoolName: schoolUnits.name, schoolCode: schoolUnits.code,
    }).from(schoolUnits)
      .innerJoin(schoolSites, eq(schoolSites.schoolId, schoolUnits.id))
      .leftJoin(siteTemplates, eq(siteTemplates.id, schoolSites.templateId))
      .innerJoin(sitePages, and(eq(sitePages.siteId, schoolSites.id), eq(sitePages.slug, slug.data)))
      .innerJoin(sitePublications, eq(sitePublications.pageId, sitePages.id))
      .innerJoin(sitePageVersions, eq(sitePageVersions.id, sitePublications.pageVersionId))
      .where(and(eq(schoolUnits.code, code.data), eq(schoolUnits.status, "active"), eq(schoolSites.status, "published")))
      .orderBy(desc(sitePublications.publishedAt)).limit(1);
    if (!result) { res.status(404).json({ error: { code: "PUBLIC_PAGE_NOT_FOUND", message: "Halaman belum tersedia untuk publik." } }); return; }
    res.json({ data: result });
  } catch (error) { next(error); }
});
