import { z } from "zod";
const cmsSlugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens");
const safeExternalUrl = z.string().url().refine((value) => { const protocol = new URL(value).protocol; return protocol === "https:" || protocol === "http:"; }, "Only HTTP and HTTPS URLs are allowed");
const safeLinkUrl = z.string().trim().min(1).max(500).refine((value) => value.startsWith("/") && !value.startsWith("//") || value.startsWith("#") || safeExternalUrl.safeParse(value).success, "Use a relative path or HTTP/HTTPS URL");
const cmsBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(64), type: z.literal("hero"), title: z.string().max(180), subtitle: z.string().max(500).default(""), imageUrl: safeExternalUrl.optional(), buttonLabel: z.string().max(60).optional(), buttonUrl: safeLinkUrl.optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("heading"), text: z.string().min(1).max(180), level: z.enum(["h2","h3"]).default("h2") }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("rich_text"), text: z.string().max(5000) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("image"), url: safeExternalUrl, alt: z.string().max(250), caption: z.string().max(300).optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("notice"), title: z.string().max(180), text: z.string().max(1500) }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("button"), label: z.string().min(1).max(60), url: safeLinkUrl }),
]);
const cmsPageDocumentSchema = z.object({ schemaVersion: z.literal("1.0"), blocks: z.array(cmsBlockSchema).max(60) }).superRefine((document, context) => {
  const ids = document.blocks.map((block) => block.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Block IDs must be unique within a page.", path: ["blocks"] });
});
const cmsCreatePageSchema = z.object({ title: z.string().trim().min(2).max(180), slug: cmsSlugSchema, isHome: z.boolean().default(false) });
const cmsSavePageSchema = z.object({ document: cmsPageDocumentSchema });

