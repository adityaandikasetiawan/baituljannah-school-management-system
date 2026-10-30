import { describe, expect, it } from "vitest";
import { APP_VERSION, API_VERSION } from "../../version.js";

describe("application version metadata", () => {
  it("exposes a semantic application version", () => expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/));
  it("keeps the initial API contract versioned", () => expect(API_VERSION).toBe("v1"));
});
