import { describe, expect, it } from "vitest";
import { z } from "zod";
const schema = z.object({ organizationId: z.uuid(), code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/), name: z.string().trim().min(2).max(180), level: z.enum(["TK","SD","SMP","SMA","SLB"]) });
describe("school-unit input contract", () => {
  it("accepts a valid unit payload", () => expect(schema.safeParse({ organizationId:"123e4567-e89b-12d3-a456-426614174000", code:"IT-SD", name:"Baituljannah SD", level:"SD" }).success).toBe(true));
  it("rejects malformed unit codes", () => expect(schema.safeParse({ organizationId:"123e4567-e89b-12d3-a456-426614174000", code:"it sd", name:"Baituljannah SD", level:"SD" }).success).toBe(false));
  it("rejects unsupported school levels", () => expect(schema.safeParse({ organizationId:"123e4567-e89b-12d3-a456-426614174000", code:"IT-XYZ", name:"Unit", level:"UNIVERSITY" }).success).toBe(false));
});
