import { describe, expect, it } from "vitest";
import { cmsBlockSchema, cmsPageDocumentSchema, cmsSlugSchema } from "./cms.schemas.js";

describe("CMS page document schema", () => {
  it("accepts supported safe content blocks", () => {
    const parsed = cmsPageDocumentSchema.safeParse({
      schemaVersion: "1.0",
      blocks: [
        { id: "hero", type: "hero", title: "Baituljannah", subtitle: "Sekolah unggul" },
        { id: "body", type: "rich_text", text: "Profil sekolah" },
        { id: "action", type: "button", label: "Profil", url: "/profil" },
      ],
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects javascript URLs in image blocks", () => {
    expect(cmsBlockSchema.safeParse({ id: "image", type: "image", url: "javascript:alert(1)", alt: "unsafe" }).success).toBe(false);
  });
  it("rejects javascript URLs in button blocks", () => {
    expect(cmsBlockSchema.safeParse({ id: "button", type: "button", label: "Open", url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects duplicate block identifiers", () => {
    expect(cmsPageDocumentSchema.safeParse({ schemaVersion: "1.0", blocks: [
      { id: "same", type: "heading", text: "One" },
      { id: "same", type: "heading", text: "Two" },
    ] }).success).toBe(false);
  });
  it("requires lowercase URL slugs", () => {
    expect(cmsSlugSchema.safeParse("profil-sekolah").success).toBe(true);
    expect(cmsSlugSchema.safeParse("Profil Sekolah").success).toBe(false);
  });
});
