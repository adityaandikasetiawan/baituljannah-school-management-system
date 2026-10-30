export interface AccessContext { userId: string; schoolId?: string; globalPermissions: readonly string[]; schoolMemberships: readonly { schoolId: string; permissions: readonly string[] }[] }
export type AccessDecision = { allowed: true; scope: "global" | "school"; schoolId?: string } | { allowed: false; reason: "missing_school_context" | "school_membership_required" | "permission_denied" };
export function authorizeSchoolAccess(context: AccessContext, requiredPermission: string, requestedSchoolId?: string): AccessDecision {
  const schoolId = requestedSchoolId ?? context.schoolId;
  if (context.globalPermissions.includes(requiredPermission)) return schoolId ? { allowed: true, scope: "global", schoolId } : { allowed: true, scope: "global" };
  if (!schoolId) return { allowed: false, reason: "missing_school_context" };
  const membership = context.schoolMemberships.find((item) => item.schoolId === schoolId);
  if (!membership) return { allowed: false, reason: "school_membership_required" };
  if (!membership.permissions.includes(requiredPermission)) return { allowed: false, reason: "permission_denied" };
  return { allowed: true, scope: "school", schoolId };
}
