import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { organizations, permissions, roles, rolePermissions } from "./schema/index.js";
const permissionCatalog = [["platform.manage","Manage foundation settings and school units"],["school.read","Read school-unit data"],["school.manage","Create and manage school units"],["user.manage","Manage user accounts and assignments"],["student.read","Read student records"],["student.manage","Manage student records"],["academic.manage","Manage academic configuration"],["attendance.manage","Manage attendance"],["assessment.manage","Manage assessments and grades"],["finance.manage","Manage invoices and manual payment verification"],["website.manage","Manage the school website"],["website.publish","Publish school website content"],["audit.read","Read audit logs"]] as const;
const roleCatalog = [["super_admin","Super Admin","global"],["foundation_admin","Foundation Admin","global"],["school_principal","School Principal","school"],["school_admin","School Admin","school"],["teacher","Teacher","school"],["finance","Finance","school"],["content_editor","Content Editor","school"],["parent","Parent","personal"],["student","Student","personal"]] as const;
async function seed() {
  if (!(await db.query.organizations.findFirst({ where: eq(organizations.name, "Yayasan Baituljannah") }))) await db.insert(organizations).values({ name: "Yayasan Baituljannah" });
  for (const [code, description] of permissionCatalog) if (!(await db.query.permissions.findFirst({ where: eq(permissions.code, code) }))) await db.insert(permissions).values({ code, description });
  for (const [code, name, scope] of roleCatalog) if (!(await db.query.roles.findFirst({ where: eq(roles.code, code) }))) await db.insert(roles).values({ code, name, scope });
  const allPermissions = await db.select().from(permissions);
  const allRoles = await db.select().from(roles);
  for (const role of allRoles) {
    const allowed = role.code === "super_admin" ? allPermissions : role.code === "foundation_admin" ? allPermissions.filter((p) => p.code !== "platform.manage") : [];
    for (const permission of allowed) {
      const exists = await db.query.rolePermissions.findFirst({ where: (rp, { and, eq: equals }) => and(equals(rp.roleId, role.id), equals(rp.permissionId, permission.id)) });
      if (!exists) await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
    }
  }
}
seed().then(() => pool.end()).catch(async (error: unknown) => { console.error(error); await pool.end(); process.exitCode = 1; });
