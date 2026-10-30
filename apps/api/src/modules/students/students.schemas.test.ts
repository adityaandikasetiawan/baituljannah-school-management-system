import { describe, expect, it } from "vitest";
import { studentCreateSchema, studentEnrollmentUpdateSchema } from "./students.schemas.js";
describe("student management validation", () => {
  it("accepts a valid student and enrollment payload", () => {
    expect(studentCreateSchema.safeParse({ fullName:"Siswa Contoh",gender:"female",birthDate:"2015-05-20",admissionNumber:"SD-2026-001",academicYear:"2026/2027",gradeLabel:"Kelas 5",guardians:[{fullName:"Orang Tua",relationship:"mother",phone:"081234567890"}] }).success).toBe(true);
  });
  it("rejects invalid NISN and academic-year format", () => {
    expect(studentCreateSchema.safeParse({ nisn:"123",fullName:"Siswa",gender:"male",admissionNumber:"A-1",academicYear:"2026",gradeLabel:"Kelas 1" }).success).toBe(false);
  });
  it("allows only valid enrollment lifecycle status", () => {
    expect(studentEnrollmentUpdateSchema.safeParse({status:"graduated"}).success).toBe(true);
    expect(studentEnrollmentUpdateSchema.safeParse({status:"deleted"}).success).toBe(false);
  });
});
