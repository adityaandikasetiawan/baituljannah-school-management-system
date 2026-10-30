import { describe, expect, it } from "vitest";
import { formatUnitLevel } from "./format";
describe("formatUnitLevel", () => {
  it("formats supported school levels", () => expect(formatUnitLevel("SMP")).toBe("Sekolah Menengah Pertama"));
  it("keeps unknown levels readable", () => expect(formatUnitLevel("OTHER")).toBe("OTHER"));
});
