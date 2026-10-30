import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";
describe("web application version", () => {
  it("uses semantic version format", () => expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/));
});
