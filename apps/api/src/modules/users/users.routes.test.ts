import { describe, expect, it } from "vitest";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(180),
  password: z.string().min(12).max(128),
  roleCode: z.enum(["school_principal", "school_admin", "teacher", "finance", "content_editor"]),
});

describe("user management input contract", () => {
  it("normalizes email addresses", () => {
    expect(createUserSchema.parse({ email: " TEACHER@BAITULJANNAH.SCH.ID ", fullName: "Guru", password: "a-secure-password", roleCode: "teacher" }).email).toBe("teacher@baituljannah.sch.id");
  });
  it("requires a strong initial password", () => {
    expect(createUserSchema.safeParse({ email: "guru@example.com", fullName: "Guru", password: "short", roleCode: "teacher" }).success).toBe(false);
  });
  it("rejects global or personal roles for school assignment", () => {
    expect(createUserSchema.safeParse({ email: "guru@example.com", fullName: "Guru", password: "a-secure-password", roleCode: "super_admin" }).success).toBe(false);
    expect(createUserSchema.safeParse({ email: "guru@example.com", fullName: "Guru", password: "a-secure-password", roleCode: "parent" }).success).toBe(false);
  });
});
