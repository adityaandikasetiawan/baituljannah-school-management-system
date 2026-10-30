import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import { db, pool } from "./client.js";
import { organizations, permissions, roles, rolePermissions, siteTemplates, schoolSites } from "./schema/index.js";
const permissionCatalog = [["platform.manage","Manage foundation settings and school units"],["school.read","Read school-unit data"],["school.manage","Create and manage school units"],["user.manage","Manage user accounts and assignments"],["teacher.manage","Manage teacher profiles and assignments"],["student.read","Read student records"],["student.manage","Manage student records"],["academic.manage","Manage academic configuration"],["attendance.manage","Manage attendance"],["assessment.manage","Manage assessments and grades"],["finance.manage","Manage invoices and manual payment verification"],["website.manage","Manage the school website"],["website.publish","Publish school website content"],["audit.read","Read audit logs"]] as const;
const roleCatalog = [["super_admin","Super Admin","global"],["foundation_admin","Foundation Admin","global"],["school_principal","School Principal","school"],["school_admin","School Admin","school"],["teacher","Teacher","school"],["finance","Finance","school"],["content_editor","Content Editor","school"],["parent","Parent","personal"],["student","Student","personal"]] as const;
const rolePermissionsMap: Record<string, string[]> = {
  school_principal: ["school.read","user.manage","teacher.manage","student.read","student.manage","academic.manage","attendance.manage","assessment.manage","finance.manage","website.manage","website.publish","audit.read"],
  school_admin: ["school.read","user.manage","student.read","student.manage","academic.manage","attendance.manage","assessment.manage","website.manage","website.publish"],
  teacher: ["school.read","student.read","attendance.manage","assessment.manage"],
  finance: ["school.read","finance.manage"],
  content_editor: ["school.read","website.manage","website.publish"],
};
async function seed() {
  if (!(await db.query.organizations.findFirst({ where: eq(organizations.name, "Yayasan Baituljannah") }))) await db.insert(organizations).values({ name: "Yayasan Baituljannah" });
  for (const [code, description] of permissionCatalog) if (!(await db.query.permissions.findFirst({ where: eq(permissions.code, code) }))) await db.insert(permissions).values({ code, description });
  for (const [code, name, scope] of roleCatalog) if (!(await db.query.roles.findFirst({ where: eq(roles.code, code) }))) await db.insert(roles).values({ code, name, scope });
  const allPermissions = await db.select().from(permissions);
  const allRoles = await db.select().from(roles);
  for (const role of allRoles) {
    const allowed = role.code === "super_admin" ? allPermissions : role.code === "foundation_admin" ? allPermissions.filter((p) => p.code !== "platform.manage") : allPermissions.filter((p) => (rolePermissionsMap[role.code] ?? []).includes(p.code));
    for (const permission of allowed) {
      const exists = await db.query.rolePermissions.findFirst({ where: (rp, { and, eq: equals }) => and(equals(rp.roleId, role.id), equals(rp.permissionId, permission.id)) });
      if (!exists) await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
    }
  }
  let defaultTemplate = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.code, "baituljannah-classic") });
  if (!defaultTemplate) {
    const [createdTemplate] = await db.insert(siteTemplates).values({
      code: "baituljannah-classic", name: "Baituljannah Classic", schemaVersion: "1.0",
      definition: { schemaVersion: "1.0", theme: { primaryColor: "#166534", surfaceColor: "#f0fdf4", textColor: "#14532d" }, sections: [
        { type: "hero", label: "Hero", description: "Banner utama sekolah" },
        { type: "heading", label: "Judul", description: "Judul bagian halaman" },
        { type: "rich_text", label: "Teks", description: "Informasi dan deskripsi sekolah" },
        { type: "image", label: "Gambar", description: "Foto kegiatan atau fasilitas" },
        { type: "notice", label: "Pengumuman", description: "Informasi penting sekolah" },
        { type: "button", label: "Tombol", description: "Tautan tindakan" },
      ] },
    }).returning();
    defaultTemplate = createdTemplate;
  }
  if (!(await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.code, "baituljannah-modern") }))) {
    await db.insert(siteTemplates).values({
      code: "baituljannah-modern", name: "Baituljannah Modern", schemaVersion: "1.0",
      definition: { schemaVersion: "1.0", theme: { primaryColor: "#1d4ed8", surfaceColor: "#eff6ff", textColor: "#172554" }, sections: [
        { type: "hero", label: "Hero", description: "Banner utama sekolah" },
        { type: "heading", label: "Judul", description: "Judul bagian halaman" },
        { type: "rich_text", label: "Teks", description: "Informasi dan deskripsi sekolah" },
        { type: "image", label: "Gambar", description: "Foto kegiatan atau fasilitas" },
        { type: "notice", label: "Pengumuman", description: "Informasi penting sekolah" },
        { type: "button", label: "Tombol", description: "Tautan tindakan" },
      ] },
    });
  }
  if (defaultTemplate) await db.update(schoolSites).set({ templateId: defaultTemplate.id }).where(isNull(schoolSites.templateId));
}
seed().then(() => pool.end()).catch(async (error: unknown) => { console.error(error); await pool.end(); process.exitCode = 1; });
