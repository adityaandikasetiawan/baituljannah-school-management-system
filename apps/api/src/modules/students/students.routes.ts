import { Router } from "express";
import type { Request, Response } from "express";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs, schoolUnits, studentEnrollments, studentGuardians, students } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { studentCreateSchema, studentUpdateSchema, studentEnrollmentUpdateSchema, guardianCreateSchema } from "./students.schemas.js";

export const studentsRouter = Router();
function selectedSchool(req: Request, res: Response): string | null {
  if (!req.schoolId) { res.status(400).json({ error: { code: "SCHOOL_CONTEXT_REQUIRED", message: "Pilih school unit melalui header x-school-id." } }); return null; }
  return req.schoolId;
}
studentsRouter.use(authenticate, loadAccessContext);
studentsRouter.get("/", requirePermission("student.read"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res); if (!schoolId) return;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const filters = [eq(studentEnrollments.schoolId, schoolId)];
  if (search) filters.push(or(ilike(students.fullName, `%${search}%`), ilike(studentEnrollments.admissionNumber, `%${search}%`), ilike(students.nisn, `%${search}%`))!);
  if (status) {
    const parsedStatus = z.enum(["candidate","active","graduated","transferred","withdrawn"]).safeParse(status);
    if (!parsedStatus.success) { res.status(400).json({ error: { code: "INVALID_STATUS", message: "Filter status tidak valid." } }); return; }
    filters.push(eq(studentEnrollments.status, parsedStatus.data));
  }
  try {
    const rows = await db.select({
      id: students.id, nisn: students.nisn, fullName: students.fullName, preferredName: students.preferredName,
      gender: students.gender, birthDate: students.birthDate, recordStatus: students.recordStatus,
      enrollmentId: studentEnrollments.id, admissionNumber: studentEnrollments.admissionNumber,
      academicYear: studentEnrollments.academicYear, gradeLabel: studentEnrollments.gradeLabel, enrollmentStatus: studentEnrollments.status,
    }).from(studentEnrollments).innerJoin(students, eq(students.id, studentEnrollments.studentId))
      .where(and(...filters)).orderBy(asc(students.fullName)).limit(pageSize).offset((page-1)*pageSize);
    res.json({ data: rows, meta: { page, pageSize, returned: rows.length } });
  } catch (error) { next(error); }
});
studentsRouter.post("/", requirePermission("student.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res); if (!schoolId) return;
  const parsed = studentCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Data siswa tidak valid.", details: parsed.error.flatten() } }); return; }
  try {
    const school = await db.query.schoolUnits.findFirst({ where: eq(schoolUnits.id, schoolId) });
    if (!school || school.status !== "active") { res.status(404).json({ error: { code: "SCHOOL_NOT_FOUND", message: "Unit sekolah tidak ditemukan atau tidak aktif." } }); return; }
    const created = await db.transaction(async (tx) => {
      const [student] = await tx.insert(students).values({
        organizationId: school.organizationId, nisn: parsed.data.nisn || null, fullName: parsed.data.fullName,
        preferredName: parsed.data.preferredName || null, gender: parsed.data.gender, birthPlace: parsed.data.birthPlace || null,
        birthDate: parsed.data.birthDate || null, address: parsed.data.address || null,
      }).returning();
      if (!student) throw new Error("Student insert returned no row");
      const [enrollment] = await tx.insert(studentEnrollments).values({
        studentId: student.id, schoolId, admissionNumber: parsed.data.admissionNumber,
        academicYear: parsed.data.academicYear, gradeLabel: parsed.data.gradeLabel,
        status: parsed.data.enrollmentStatus, startDate: parsed.data.startDate || null,
      }).returning();
      if (!enrollment) throw new Error("Enrollment insert returned no row");
      if (parsed.data.guardians.length) await tx.insert(studentGuardians).values(parsed.data.guardians.map((guardian) => ({ ...guardian, studentId: student.id })));
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "student.created", entityType: "student", entityId: student.id, metadata: { admissionNumber: enrollment.admissionNumber, academicYear: enrollment.academicYear } });
      return { student, enrollment };
    });
    res.status(201).json({ data: created });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: { code: "STUDENT_DUPLICATE", message: "NISN, nomor induk, atau pendaftaran tahun ajaran ini sudah terdaftar." } }); return;
    }
    next(error);
  }
});
studentsRouter.get("/:studentId", requirePermission("student.read"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res); if (!schoolId) return;
  const id = z.uuid().safeParse(req.params.studentId);
  if (!id.success) { res.status(400).json({ error: { code: "INVALID_STUDENT_ID", message: "ID siswa tidak valid." } }); return; }
  try {
    const [row] = await db.select({ student: students, enrollment: studentEnrollments })
      .from(studentEnrollments).innerJoin(students, eq(students.id, studentEnrollments.studentId))
      .where(and(eq(studentEnrollments.schoolId, schoolId), eq(students.id, id.data))).limit(1);
    if (!row) { res.status(404).json({ error: { code: "STUDENT_NOT_FOUND", message: "Siswa tidak ditemukan pada unit ini." } }); return; }
    const guardians = await db.select().from(studentGuardians).where(eq(studentGuardians.studentId, id.data));
    res.json({ data: { ...row, guardians } });
  } catch (error) { next(error); }
});
studentsRouter.patch("/:studentId", requirePermission("student.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res); if (!schoolId) return;
  const id = z.uuid().safeParse(req.params.studentId);
  const parsed = studentUpdateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "ID atau data siswa tidak valid.", details: parsed.success ? undefined : parsed.error.flatten() } }); return; }
  try {
    const enrollment = await db.query.studentEnrollments.findFirst({ where: and(eq(studentEnrollments.studentId, id.data), eq(studentEnrollments.schoolId, schoolId)) });
    if (!enrollment) { res.status(404).json({ error: { code: "STUDENT_NOT_FOUND", message: "Siswa tidak ditemukan pada unit ini." } }); return; }
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(students).set({ ...parsed.data, updatedAt: new Date() }).where(eq(students.id, id.data)).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "student.updated", entityType: "student", entityId: id.data, metadata: parsed.data });
      return rows;
    });
    res.json({ data: updated });
  } catch (error) { next(error); }
});
studentsRouter.patch("/:studentId/enrollment", requirePermission("student.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res); if (!schoolId) return;
  const id = z.uuid().safeParse(req.params.studentId);
  const parsed = studentEnrollmentUpdateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Data pendaftaran tidak valid.", details: parsed.success ? undefined : parsed.error.flatten() } }); return; }
  try {
    const enrollment = await db.query.studentEnrollments.findFirst({ where: and(eq(studentEnrollments.studentId, id.data), eq(studentEnrollments.schoolId, schoolId)) });
    if (!enrollment) { res.status(404).json({ error: { code: "ENROLLMENT_NOT_FOUND", message: "Pendaftaran siswa tidak ditemukan pada unit ini." } }); return; }
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(studentEnrollments).set({ ...parsed.data, updatedAt: new Date() }).where(eq(studentEnrollments.id, enrollment.id)).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "student.enrollment_updated", entityType: "student_enrollment", entityId: enrollment.id, metadata: parsed.data });
      return rows;
    });
    res.json({ data: updated });
  } catch (error) { next(error); }
});
studentsRouter.post("/:studentId/guardians", requirePermission("student.manage"), async (req, res, next) => {
  const schoolId = selectedSchool(req, res); if (!schoolId) return;
  const id = z.uuid().safeParse(req.params.studentId);
  const parsed = guardianCreateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Data wali tidak valid.", details: parsed.success ? undefined : parsed.error.flatten() } }); return; }
  try {
    const enrollment = await db.query.studentEnrollments.findFirst({ where: and(eq(studentEnrollments.studentId, id.data), eq(studentEnrollments.schoolId, schoolId)) });
    if (!enrollment) { res.status(404).json({ error: { code: "STUDENT_NOT_FOUND", message: "Siswa tidak ditemukan pada unit ini." } }); return; }
    const [guardian] = await db.transaction(async (tx) => {
      if (parsed.data.isPrimary) await tx.update(studentGuardians).set({ isPrimary: false }).where(eq(studentGuardians.studentId, id.data));
      const rows = await tx.insert(studentGuardians).values({ ...parsed.data, studentId: id.data }).returning();
      await tx.insert(auditLogs).values({ actorUserId: req.auth!.sub, schoolId, action: "student.guardian_added", entityType: "student", entityId: id.data, metadata: { relationship: parsed.data.relationship } });
      return rows;
    });
    res.status(201).json({ data: guardian });
  } catch (error) { next(error); }
});
