import { Router } from "express";
import type { Request, Response as ExpressResponse } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { academicYears, auditLogs, classGroups, classSubjects, subjects, userSchoolRoles } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";

export const academicRouter = Router();
function selectedSchool(req:Request,res:ExpressResponse):string|null {
  if(!req.schoolId){res.status(400).json({error:{code:"SCHOOL_CONTEXT_REQUIRED",message:"Pilih school unit melalui header x-school-id."}});return null;}
  return req.schoolId;
}
academicRouter.use(authenticate,loadAccessContext);
academicRouter.get("/years",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  try{const rows=await db.select().from(academicYears).where(eq(academicYears.schoolId,schoolId)).orderBy(asc(academicYears.startDate));res.json({data:rows});}
  catch(error){next(error);}
});
academicRouter.post("/years",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  const parsed=z.object({label:z.string().regex(/^\d{4}\/\d{4}$/),startDate:z.iso.date(),endDate:z.iso.date(),status:z.enum(["draft","active","closed"]).default("draft"),isCurrent:z.boolean().default(false)}).refine(v=>v.startDate<v.endDate).safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Periode tahun ajaran tidak valid.",details:parsed.error.flatten()}});return;}
  try{
    const [year]=await db.transaction(async(tx)=>{
      if(parsed.data.isCurrent)await tx.update(academicYears).set({isCurrent:false,updatedAt:new Date()}).where(eq(academicYears.schoolId,schoolId));
      const rows=await tx.insert(academicYears).values({...parsed.data,schoolId}).returning();
      await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"academic.year_created",entityType:"academic_year",entityId:rows[0]?.id,metadata:{label:parsed.data.label}});
      return rows;
    });
    res.status(201).json({data:year});
  }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"YEAR_ALREADY_EXISTS",message:"Tahun ajaran sudah terdaftar."}});return;}next(error);}
});
academicRouter.get("/classes",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  try{
    const rows=await db.select({id:classGroups.id,code:classGroups.code,name:classGroups.name,gradeLabel:classGroups.gradeLabel,capacity:classGroups.capacity,academicYearId:classGroups.academicYearId,academicYear:academicYears.label,homeroomTeacherId:classGroups.homeroomTeacherId})
      .from(classGroups).innerJoin(academicYears,eq(academicYears.id,classGroups.academicYearId)).where(eq(classGroups.schoolId,schoolId)).orderBy(asc(academicYears.label),asc(classGroups.name));
    res.json({data:rows});
  }catch(error){next(error);}
});
academicRouter.post("/classes",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  const parsed=z.object({academicYearId:z.uuid(),code:z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/),name:z.string().trim().min(2).max(100),gradeLabel:z.string().trim().min(1).max(40),capacity:z.coerce.number().int().min(1).max(80).default(36),homeroomTeacherId:z.uuid().optional()}).safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data kelas tidak valid.",details:parsed.error.flatten()}});return;}
  try{
    const year=await db.query.academicYears.findFirst({where:and(eq(academicYears.id,parsed.data.academicYearId),eq(academicYears.schoolId,schoolId))});
    if(!year){res.status(404).json({error:{code:"ACADEMIC_YEAR_NOT_FOUND",message:"Tahun ajaran tidak ditemukan pada unit ini."}});return;}
    if(parsed.data.homeroomTeacherId){
      const membership=await db.query.userSchoolRoles.findFirst({where:and(eq(userSchoolRoles.userId,parsed.data.homeroomTeacherId),eq(userSchoolRoles.schoolId,schoolId))});
      if(!membership){res.status(400).json({error:{code:"TEACHER_NOT_ASSIGNED",message:"Wali kelas harus terdaftar pada unit sekolah ini."}});return;}
    }
    const [created]=await db.transaction(async(tx)=>{
      const rows=await tx.insert(classGroups).values({...parsed.data,schoolId,capacity:String(parsed.data.capacity)}).returning();
      await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"academic.class_created",entityType:"class_group",entityId:rows[0]?.id,metadata:{code:parsed.data.code,academicYearId:year.id}});
      return rows;
    });
    res.status(201).json({data:created});
  }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"CLASS_CODE_EXISTS",message:"Kode kelas sudah digunakan pada tahun ajaran ini."}});return;}next(error);}
});
academicRouter.get("/subjects",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  try{const rows=await db.select().from(subjects).where(eq(subjects.schoolId,schoolId)).orderBy(asc(subjects.name));res.json({data:rows});}
  catch(error){next(error);}
});
academicRouter.post("/subjects",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  const parsed=z.object({code:z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/),name:z.string().trim().min(2).max(140),gradeLevel:z.string().trim().max(40).optional(),description:z.string().trim().max(1000).optional()}).safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data mata pelajaran tidak valid.",details:parsed.error.flatten()}});return;}
  try{
    const [created]=await db.transaction(async(tx)=>{
      const rows=await tx.insert(subjects).values({...parsed.data,schoolId}).returning();
      await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"academic.subject_created",entityType:"subject",entityId:rows[0]?.id,metadata:{code:parsed.data.code}});
      return rows;
    });
    res.status(201).json({data:created});
  }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"SUBJECT_CODE_EXISTS",message:"Kode mata pelajaran sudah digunakan."}});return;}next(error);}
});
academicRouter.post("/classes/:classId/subjects",requirePermission("academic.manage"),async(req,res,next)=>{
  const schoolId=selectedSchool(req,res);if(!schoolId)return;
  const classId=z.uuid().safeParse(req.params.classId);
  const parsed=z.object({subjectId:z.uuid(),teacherId:z.uuid().optional()}).safeParse(req.body);
  if(!classId.success||!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"ID kelas atau data mata pelajaran tidak valid."}});return;}
  try{
    const classGroup=await db.query.classGroups.findFirst({where:and(eq(classGroups.id,classId.data),eq(classGroups.schoolId,schoolId))});
    const subject=await db.query.subjects.findFirst({where:and(eq(subjects.id,parsed.data.subjectId),eq(subjects.schoolId,schoolId))});
    if(!classGroup||!subject){res.status(404).json({error:{code:"CLASS_OR_SUBJECT_NOT_FOUND",message:"Kelas atau mata pelajaran tidak ditemukan pada unit ini."}});return;}
    if(parsed.data.teacherId){
      const membership=await db.query.userSchoolRoles.findFirst({where:and(eq(userSchoolRoles.userId,parsed.data.teacherId),eq(userSchoolRoles.schoolId,schoolId))});
      if(!membership){res.status(400).json({error:{code:"TEACHER_NOT_ASSIGNED",message:"Guru harus terdaftar pada unit sekolah ini."}});return;}
    }
    const [created]=await db.transaction(async(tx)=>{
      const rows=await tx.insert(classSubjects).values({classGroupId:classId.data,subjectId:subject.id,teacherId:parsed.data.teacherId}).returning();
      await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"academic.class_subject_assigned",entityType:"class_group",entityId:classId.data,metadata:{subjectId:subject.id,teacherId:parsed.data.teacherId}});
      return rows;
    });
    res.status(201).json({data:created});
  }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"SUBJECT_ALREADY_ASSIGNED",message:"Mata pelajaran sudah ditambahkan ke kelas ini."}});return;}next(error);}
});
