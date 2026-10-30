import { z } from "zod";
const guardianSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  relationship: z.enum(["father","mother","guardian","other"]),
  phone: z.string().trim().min(8).max(32),
  email: z.email().optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
  canPickup: z.boolean().default(false),
});
export const guardianCreateSchema = guardianSchema;
export const studentCreateSchema = z.object({
  nisn: z.string().regex(/^\d{10}$/,"NISN harus 10 digit.").optional().or(z.literal("")),
  fullName: z.string().trim().min(2).max(180),
  preferredName: z.string().trim().max(100).optional(),
  gender: z.enum(["male","female"]),
  birthPlace: z.string().trim().max(120).optional(),
  birthDate: z.iso.date().optional(),
  address: z.string().trim().max(3000).optional(),
  admissionNumber: z.string().trim().min(2).max(40),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
  gradeLabel: z.string().trim().min(1).max(40),
  enrollmentStatus: z.enum(["candidate","active"]).default("active"),
  startDate: z.iso.date().optional(),
  guardians: z.array(guardianSchema).max(5).default([]),
});
export const studentUpdateSchema = z.object({
  nisn: z.string().regex(/^\d{10}$/).optional().or(z.literal("")),
  fullName: z.string().trim().min(2).max(180).optional(),
  preferredName: z.string().trim().max(100).optional(),
  gender: z.enum(["male","female"]).optional(),
  birthPlace: z.string().trim().max(120).optional(),
  birthDate: z.iso.date().optional(),
  address: z.string().trim().max(3000).optional(),
  recordStatus: z.enum(["active","inactive","archived"]).optional(),
}).refine((value) => Object.keys(value).length > 0);
export const studentEnrollmentUpdateSchema = z.object({
  classGroupId: z.uuid().nullable().optional(),
  admissionNumber: z.string().trim().min(2).max(40).optional(),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/).optional(),
  gradeLabel: z.string().trim().min(1).max(40).optional(),
  status: z.enum(["candidate","active","graduated","transferred","withdrawn"]).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
}).refine((value) => Object.keys(value).length > 0);
