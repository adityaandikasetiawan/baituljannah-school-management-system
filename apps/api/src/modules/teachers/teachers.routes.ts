import { Router } from "express";
import type { Request, Response as ExpressResponse } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs, roles, teacherProfiles, userSchoolRoles, users } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";
export const teachersRouter=Router();
function selectedSchool(req:Request,res:ExpressResponse):string|null{if(!req.schoolId){res.status(400).json({error:{code:"SCHOOL_CONTEXT_REQUIRED",message:"Pilih school unit melalui header x-school-id."}});return null;}return req.schoolId;}
teachersRouter.use(authenticate,loadAccessContext);
teachersRouter.get("/",requirePermission("teacher.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 try{
  const rows=await db.select({id:teacherProfiles.id,userId:users.id,email:users.email,fullName:users.fullName,employeeNumber:teacherProfiles.employeeNumber,jobTitle:teacherProfiles.jobTitle,specialization:teacherProfiles.specialization,hireDate:teacherProfiles.hireDate,employmentStatus:teacherProfiles.employmentStatus})
   .from(teacherProfiles).innerJoin(users,eq(users.id,teacherProfiles.userId)).where(eq(teacherProfiles.schoolId,schoolId)).orderBy(asc(users.fullName));
  res.json({data:rows});
 }catch(error){next(error);}
});
teachersRouter.post("/",requirePermission("teacher.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const parsed=z.object({email:z.string().trim().pipe(z.email()).transform(v=>v.toLowerCase()),employeeNumber:z.string().trim().min(2).max(40),jobTitle:z.string().trim().min(2).max(100).default("Guru"),specialization:z.string().trim().max(180).optional(),hireDate:z.iso.date().optional()}).safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data profil guru tidak valid.",details:parsed.error.flatten()}});return;}
 try{
  const user=await db.query.users.findFirst({where:eq(users.email,parsed.data.email)});
  if(!user){res.status(404).json({error:{code:"USER_NOT_FOUND",message:"Buat akun dengan role Teacher pada menu Pengguna & Akses terlebih dahulu."}});return;}
  const membership=await db.select({roleCode:roles.code}).from(userSchoolRoles).innerJoin(roles,eq(roles.id,userSchoolRoles.roleId)).where(and(eq(userSchoolRoles.userId,user.id),eq(userSchoolRoles.schoolId,schoolId)));
  if(!membership.some(item=>item.roleCode==="teacher")){res.status(409).json({error:{code:"TEACHER_ROLE_REQUIRED",message:"Akun harus memiliki role Teacher pada unit sekolah ini."}});return;}
  const [profile]=await db.transaction(async(tx)=>{
   const rows=await tx.insert(teacherProfiles).values({schoolId,userId:user.id,employeeNumber:parsed.data.employeeNumber,jobTitle:parsed.data.jobTitle,specialization:parsed.data.specialization??null,hireDate:parsed.data.hireDate??null}).returning();
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"teacher.profile_created",entityType:"teacher_profile",entityId:rows[0]?.id,metadata:{employeeNumber:parsed.data.employeeNumber,userId:user.id}});
   return rows;
  });
  res.status(201).json({data:{...profile,user:{id:user.id,email:user.email,fullName:user.fullName}}});
 }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"TEACHER_PROFILE_EXISTS",message:"Profil guru atau nomor pegawai sudah terdaftar."}});return;}next(error);}
});
teachersRouter.patch("/:profileId",requirePermission("teacher.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const id=z.uuid().safeParse(req.params.profileId);
 const parsed=z.object({employeeNumber:z.string().trim().min(2).max(40).optional(),jobTitle:z.string().trim().min(2).max(100).optional(),specialization:z.string().trim().max(180).nullable().optional(),hireDate:z.iso.date().nullable().optional(),employmentStatus:z.enum(["active","leave","inactive"]).optional()}).refine(v=>Object.keys(v).length>0).safeParse(req.body);
 if(!id.success||!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data profil guru tidak valid."}});return;}
 try{
  const profile=await db.query.teacherProfiles.findFirst({where:and(eq(teacherProfiles.id,id.data),eq(teacherProfiles.schoolId,schoolId))});
  if(!profile){res.status(404).json({error:{code:"TEACHER_NOT_FOUND",message:"Profil guru tidak ditemukan pada unit ini."}});return;}
  const [updated]=await db.transaction(async(tx)=>{
   const rows=await tx.update(teacherProfiles).set({...parsed.data,updatedAt:new Date()}).where(eq(teacherProfiles.id,profile.id)).returning();
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"teacher.profile_updated",entityType:"teacher_profile",entityId:profile.id,metadata:parsed.data});
   return rows;
  });
  res.json({data:updated});
 }catch(error){next(error);}
});
