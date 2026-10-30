import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db } from "../../db/client.js";
import { globalUserRoles, permissions, rolePermissions, roles, userSchoolRoles } from "../../db/schema/index.js";

export const loadAccessContext: RequestHandler = async (req, res, next) => {
  if (!req.auth) { res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); return; }
  try {
    const globalRows = await db.select({ permission: permissions.code })
      .from(globalUserRoles).innerJoin(roles, eq(globalUserRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(globalUserRoles.userId, req.auth.sub));
    const schoolRows = await db.select({ schoolId: userSchoolRoles.schoolId, permission: permissions.code })
      .from(userSchoolRoles).innerJoin(roles, eq(userSchoolRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userSchoolRoles.userId, req.auth.sub));
    const bySchool = new Map<string, string[]>();
    for (const row of schoolRows) bySchool.set(row.schoolId, [...(bySchool.get(row.schoolId) ?? []), row.permission]);
    res.locals.accessContext = {
      userId: req.auth.sub,
      globalPermissions: [...new Set(globalRows.map((row) => row.permission))],
      schoolMemberships: [...bySchool.entries()].map(([schoolId, perms]) => ({ schoolId, permissions: [...new Set(perms)] })),
    };
    next();
  } catch (error) { next(error); }
};
