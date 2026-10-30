import { describe, expect, it } from "vitest";
import { authorizeSchoolAccess } from "./tenant-access.js";
const context = { userId: "user-1", schoolMemberships: [{ schoolId: "school-a", permissions: ["student.read", "website.manage"] }], globalPermissions: [] };
describe("authorizeSchoolAccess", () => {
  it("allows a member with permission in their school", () => expect(authorizeSchoolAccess(context, "student.read", "school-a")).toEqual({ allowed: true, scope: "school", schoolId: "school-a" }));
  it("denies a different school", () => expect(authorizeSchoolAccess(context, "student.read", "school-b")).toEqual({ allowed: false, reason: "school_membership_required" }));
  it("denies a permission absent from membership", () => expect(authorizeSchoolAccess(context, "finance.manage", "school-a")).toEqual({ allowed: false, reason: "permission_denied" }));
  it("requires a school context for non-global permissions", () => expect(authorizeSchoolAccess(context, "student.read")).toEqual({ allowed: false, reason: "missing_school_context" }));
  it("allows a global permission across units", () => expect(authorizeSchoolAccess({ ...context, globalPermissions: ["platform.manage"] }, "platform.manage", "school-b")).toEqual({ allowed: true, scope: "global", schoolId: "school-b" }));
});
