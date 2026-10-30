import { Router } from "express";
import type { Request, Response as ExpressResponse } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { academicYears, attendanceRecords, attendanceSessions, auditLogs, classGroups, classSubjects, schoolUnits, studentEnrollments, students, subjects } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";
export const attendanceRouter=Router();
function selectedSchool(req:Request,res:ExpressResponse):string|null{if(!req.schoolId){res.status(400).json({error:{code:"SCHOOL_CONTEXT_REQUIRED",message:"Pilih school unit melalui header x-school-id."}});return null;}return req.schoolId;}
attendanceRouter.use(authenticate,loadAccessContext);
attendanceRouter.get("/classes",requirePermission("attendance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 try{const rows=await db.select({id:classGroups.id,code:classGroups.code,name:classGroups.name,gradeLabel:classGroups.gradeLabel,academicYear:academicYears.label}).from(classGroups).innerJoin(academicYears,eq(academicYears.id,classGroups.academicYearId)).where(and(eq(classGroups.schoolId,schoolId),eq(academicYears.isCurrent,true))).orderBy(asc(classGroups.name));res.json({data:rows});}
 catch(error){next(error);}
});
attendanceRouter.get("/sessions",requirePermission("attendance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const date=z.iso.date().safeParse(req.query.date);
 const classId=z.uuid().optional().safeParse(req.query.classGroupId);
 if(req.query.date&&!date.success){res.status(400).json({error:{code:"INVALID_DATE",message:"Tanggal tidak valid."}});return;}
 if(req.query.classGroupId&&!classId.success){res.status(400).json({error:{code:"INVALID_CLASS_ID",message:"ID kelas tidak valid."}});return;}
 try{
  const filters=[eq(attendanceSessions.schoolId,schoolId)];
  if(date.success&&date.data)filters.push(eq(attendanceSessions.sessionDate,date.data));
  if(classId.success&&classId.data)filters.push(eq(attendanceSessions.classGroupId,classId.data));
  const rows=await db.select({id:attendanceSessions.id,sessionDate:attendanceSessions.sessionDate,status:attendanceSessions.status,classGroupId:classGroups.id,className:classGroups.name,subjectId:subjects.id,subjectName:subjects.name}).from(attendanceSessions).innerJoin(classGroups,eq(classGroups.id,attendanceSessions.classGroupId)).leftJoin(subjects,eq(subjects.id,attendanceSessions.subjectId)).where(and(...filters)).orderBy(asc(attendanceSessions.sessionDate));
  res.json({data:rows});
 }catch(error){next(error);}
});
attendanceRouter.post("/sessions",requirePermission("attendance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const parsed=z.object({classGroupId:z.uuid(),sessionDate:z.iso.date(),subjectId:z.uuid().optional()}).safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data sesi absensi tidak valid.",details:parsed.error.flatten()}});return;}
 try{
  const classGroup=await db.query.classGroups.findFirst({where:and(eq(classGroups.id,parsed.data.classGroupId),eq(classGroups.schoolId,schoolId))});
  if(!classGroup){res.status(404).json({error:{code:"CLASS_NOT_FOUND",message:"Kelas tidak ditemukan pada unit ini."}});return;}
  const duplicateFilter=parsed.data.subjectId
    ? and(eq(attendanceSessions.classGroupId,classGroup.id),eq(attendanceSessions.sessionDate,parsed.data.sessionDate),eq(attendanceSessions.subjectId,parsed.data.subjectId))
    : and(eq(attendanceSessions.classGroupId,classGroup.id),eq(attendanceSessions.sessionDate,parsed.data.sessionDate),isNull(attendanceSessions.subjectId));
  const duplicate=await db.query.attendanceSessions.findFirst({where:duplicateFilter});
  if(duplicate){res.status(409).json({error:{code:"SESSION_ALREADY_EXISTS",message:"Sesi absensi untuk kelas, tanggal, dan mata pelajaran tersebut sudah ada."}});return;}

  if(parsed.data.subjectId){
   const assignment=await db.query.classSubjects.findFirst({where:and(eq(classSubjects.classGroupId,classGroup.id),eq(classSubjects.subjectId,parsed.data.subjectId))});
   if(!assignment){res.status(400).json({error:{code:"SUBJECT_NOT_ASSIGNED",message:"Mata pelajaran belum ditugaskan pada kelas ini."}});return;}
  }
  const [created]=await db.transaction(async(tx)=>{
   const rows=await tx.insert(attendanceSessions).values({schoolId,classGroupId:classGroup.id,sessionDate:parsed.data.sessionDate,subjectId:parsed.data.subjectId??null,createdBy:req.auth!.sub}).returning();
   const enrolled=await tx.select({studentId:studentEnrollments.studentId}).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId,schoolId),eq(studentEnrollments.classGroupId,classGroup.id),eq(studentEnrollments.status,"active")));
   if(enrolled.length)await tx.insert(attendanceRecords).values(enrolled.map(item=>({sessionId:rows[0]!.id,studentId:item.studentId,status:"unmarked" as const})));
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"attendance.session_created",entityType:"attendance_session",entityId:rows[0]?.id,metadata:{classGroupId:classGroup.id,sessionDate:parsed.data.sessionDate,studentCount:enrolled.length}});
   return rows;
  });
  res.status(201).json({data:created});
 }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"SESSION_ALREADY_EXISTS",message:"Sesi absensi untuk kelas dan tanggal tersebut sudah ada."}});return;}next(error);}
});
attendanceRouter.get("/sessions/:sessionId",requirePermission("attendance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const id=z.uuid().safeParse(req.params.sessionId);if(!id.success){res.status(400).json({error:{code:"INVALID_SESSION_ID",message:"ID sesi tidak valid."}});return;}
 try{
  const session=await db.query.attendanceSessions.findFirst({where:and(eq(attendanceSessions.id,id.data),eq(attendanceSessions.schoolId,schoolId))});
  if(!session){res.status(404).json({error:{code:"SESSION_NOT_FOUND",message:"Sesi absensi tidak ditemukan."}});return;}
  const records=await db.select({id:attendanceRecords.id,studentId:students.id,fullName:students.fullName,admissionNumber:studentEnrollments.admissionNumber,status:attendanceRecords.status,note:attendanceRecords.note})
   .from(attendanceRecords).innerJoin(students,eq(students.id,attendanceRecords.studentId)).innerJoin(studentEnrollments,and(eq(studentEnrollments.studentId,students.id),eq(studentEnrollments.schoolId,schoolId),eq(studentEnrollments.classGroupId,session.classGroupId)))
   .where(eq(attendanceRecords.sessionId,session.id)).orderBy(asc(students.fullName));
  res.json({data:{session,records}});
 }catch(error){next(error);}
});
attendanceRouter.put("/sessions/:sessionId/records",requirePermission("attendance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const id=z.uuid().safeParse(req.params.sessionId);
 const parsed=z.object({records:z.array(z.object({studentId:z.uuid(),status:z.enum(["unmarked","present","absent","late","sick","permission"]),note:z.string().max(500).optional()})).min(1).max(100)}).safeParse(req.body);
 if(!id.success||!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data absensi tidak valid.",details:parsed.success?undefined:parsed.error.flatten()}});return;}
 try{
  const session=await db.query.attendanceSessions.findFirst({where:and(eq(attendanceSessions.id,id.data),eq(attendanceSessions.schoolId,schoolId))});
  if(!session){res.status(404).json({error:{code:"SESSION_NOT_FOUND",message:"Sesi absensi tidak ditemukan."}});return;}
  if(session.status!=="draft"){res.status(409).json({error:{code:"SESSION_LOCKED",message:"Sesi yang sudah dikirim tidak dapat diubah."}});return;}
  const allowed=await db.select({studentId:studentEnrollments.studentId}).from(studentEnrollments).where(and(eq(studentEnrollments.schoolId,schoolId),eq(studentEnrollments.classGroupId,session.classGroupId)));
  const allowedIds=new Set(allowed.map(x=>x.studentId));
  if(parsed.data.records.some(x=>!allowedIds.has(x.studentId))){res.status(400).json({error:{code:"STUDENT_NOT_IN_CLASS",message:"Terdapat siswa yang bukan anggota kelas sesi ini."}});return;}
  await db.transaction(async(tx)=>{
   for(const record of parsed.data.records)await tx.insert(attendanceRecords).values({sessionId:session.id,studentId:record.studentId,status:record.status,note:record.note??null,markedBy:req.auth!.sub,markedAt:new Date()}).onConflictDoUpdate({target:[attendanceRecords.sessionId,attendanceRecords.studentId],set:{status:record.status,note:record.note??null,markedBy:req.auth!.sub,markedAt:new Date()}});
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"attendance.records_updated",entityType:"attendance_session",entityId:session.id,metadata:{recordCount:parsed.data.records.length}});
  });
  res.json({data:{updated:parsed.data.records.length}});
 }catch(error){next(error);}
});
attendanceRouter.post("/sessions/:sessionId/submit",requirePermission("attendance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const id=z.uuid().safeParse(req.params.sessionId);if(!id.success){res.status(400).json({error:{code:"INVALID_SESSION_ID",message:"ID sesi tidak valid."}});return;}
 try{
  const session=await db.query.attendanceSessions.findFirst({where:and(eq(attendanceSessions.id,id.data),eq(attendanceSessions.schoolId,schoolId))});
  if(!session){res.status(404).json({error:{code:"SESSION_NOT_FOUND",message:"Sesi absensi tidak ditemukan."}});return;}
  const unmarked=await db.query.attendanceRecords.findFirst({where:and(eq(attendanceRecords.sessionId,session.id),eq(attendanceRecords.status,"unmarked"))});
  if(unmarked){res.status(409).json({error:{code:"ATTENDANCE_INCOMPLETE",message:"Semua status siswa harus diisi sebelum absensi dikirim."}});return;}
  const [updated]=await db.transaction(async(tx)=>{
   const rows=await tx.update(attendanceSessions).set({status:"submitted",submittedAt:new Date()}).where(eq(attendanceSessions.id,session.id)).returning();
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"attendance.session_submitted",entityType:"attendance_session",entityId:session.id,metadata:{}});
   return rows;
  });
  res.json({data:updated});
 }catch(error){next(error);}
});
