import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs, schoolSites, schoolUnits, sitePages, sitePageVersions, sitePublications, siteTemplates } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";

export const cmsRouter = Router();
const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens");
const safeExternalUrl = z.string().url().refine((value) => { const protocol = new URL(value).protocol; return protocol === "https:" || protocol === "http:"; }, "Only HTTP and HTTPS URLs are allowed");
const safeLinkUrl = z.string().trim().min(1).max(500).refine((value) => value.startsWith("/") && !value.startsWith("//") || value.startsWith("#") || safeExternalUrl.safeParse(value).success, "Use a relative path or HTTP/HTTPS URL");
const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(64), type: z.literal("hero"), title: z.string().max(180), subtitle: z.string().max(500).default(""), imageUrl: safeExternalUrl.optional(), buttonLabel: z.string().max(60).optional(), buttonUrl: safeLinkUrl.optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("heading"), text: z.string().min(1).max(180), level: z.enum(["h2","h3"]).default("h2") }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("rich_text"), text: z.string().max(5000) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("image"), url: safeExternalUrl, alt: z.string().max(250), caption: z.string().max(300).optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("notice"), title: z.string().max(180), text: z.string().max(1500) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("button"), label: z.string().min(1).max(60), url: safeLinkUrl }),
]);
const documentSchema = z.object({ schemaVersion: z.literal("1.0"), blocks: z.array(blockSchema).max(60) }).superRefine((document, context) => {
  const ids = document.blocks.map((block) => block.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Block IDs must be unique within a page.", path: ["blocks"] });
});
const createPageSchema = z.object({ title: z.string().trim().min(2).max(180), slug: slugSchema, isHome: z.boolean().default(false) });
const savePageSchema = z.object({ document: documentSchema });
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
  const parsed = createPageSchema.safeParse(req.body);
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
  const parsed = savePageSchema.safeParse(req.body);
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
publicCmsRouter.get("/schools/:schoolCode/pages/:slug", async (req, res, next) => {
  const code = z.string().trim().min(2).max(32).transform((value) => value.toUpperCase()).safeParse(req.params.schoolCode);
  const slug = slugSchema.safeParse(req.params.slug);
  if (!code.success || !slug.success) { res.status(400).json({ error: { code: "INVALID_ROUTE", message: "Alamat halaman tidak valid." } }); return; }
  try {
    const [result] = await db.select({
      pageId: sitePages.id, title: sitePages.title, slug: sitePages.slug,
      isHome: sitePages.isHome, version: sitePageVersions.version,
      document: sitePageVersions.document, publishedAt: sitePublications.publishedAt,
      siteTitle: schoolSites.title, schoolName: schoolUnits.name, schoolCode: schoolUnits.code,
    }).from(schoolUnits)
      .innerJoin(schoolSites, eq(schoolSites.schoolId, schoolUnits.id))
      .innerJoin(sitePages, and(eq(sitePages.siteId, schoolSites.id), eq(sitePages.slug, slug.data)))
      .innerJoin(sitePublications, eq(sitePublications.pageId, sitePages.id))
      .innerJoin(sitePageVersions, eq(sitePageVersions.id, sitePublications.pageVersionId))
      .where(and(eq(schoolUnits.code, code.data), eq(schoolUnits.status, "active"), eq(schoolSites.status, "published")))
      .orderBy(desc(sitePublications.publishedAt)).limit(1);
    if (!result) { res.status(404).json({ error: { code: "PUBLIC_PAGE_NOT_FOUND", message: "Halaman belum tersedia untuk publik." } }); return; }
    res.json({ data: result });
  } catch (error) { next(error); }
});
