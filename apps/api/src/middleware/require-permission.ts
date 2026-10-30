import type { RequestHandler } from "express";
import { authorizeSchoolAccess, type AccessContext } from "../modules/access/tenant-access.js";
export function requirePermission(permission: string): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) { res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); return; }
    const context = res.locals.accessContext as AccessContext | undefined;
    if (!context) { res.status(403).json({ error: { code: "ACCESS_CONTEXT_MISSING", message: "Access context is not available" } }); return; }
    const decision = authorizeSchoolAccess(context, permission, req.header("x-school-id") ?? undefined);
    if (!decision.allowed) { res.status(403).json({ error: { code: "FORBIDDEN", message: decision.reason } }); return; }
    if (decision.schoolId) req.schoolId = decision.schoolId;
    next();
  };
}
