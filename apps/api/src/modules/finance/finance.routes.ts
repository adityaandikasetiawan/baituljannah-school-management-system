import { Router } from "express";
import type { Request, Response as ExpressResponse } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs, invoices, payments, studentEnrollments, students } from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { loadAccessContext } from "../access/access-context.js";
import { requirePermission } from "../../middleware/require-permission.js";
export const financeRouter=Router();
function selectedSchool(req:Request,res:ExpressResponse):string|null{if(!req.schoolId){res.status(400).json({error:{code:"SCHOOL_CONTEXT_REQUIRED",message:"Pilih school unit melalui header x-school-id."}});return null;}return req.schoolId;}
financeRouter.use(authenticate,loadAccessContext);
financeRouter.get("/enrollments",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 try{
  const rows=await db.select({id:studentEnrollments.id,admissionNumber:studentEnrollments.admissionNumber,studentName:students.fullName,academicYear:studentEnrollments.academicYear,gradeLabel:studentEnrollments.gradeLabel,status:studentEnrollments.status})
   .from(studentEnrollments).innerJoin(students,eq(students.id,studentEnrollments.studentId)).where(and(eq(studentEnrollments.schoolId,schoolId),eq(studentEnrollments.status,"active"))).orderBy(asc(students.fullName));
  res.json({data:rows});
 }catch(error){next(error);}
});
financeRouter.get("/invoices",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 try{
  const rows=await db.select({id:invoices.id,invoiceNumber:invoices.invoiceNumber,description:invoices.description,period:invoices.period,dueDate:invoices.dueDate,amountTotal:invoices.amountTotal,amountPaid:invoices.amountPaid,status:invoices.status,studentId:students.id,studentName:students.fullName,admissionNumber:studentEnrollments.admissionNumber})
   .from(invoices).innerJoin(studentEnrollments,eq(studentEnrollments.id,invoices.enrollmentId)).innerJoin(students,eq(students.id,studentEnrollments.studentId))
   .where(eq(invoices.schoolId,schoolId)).orderBy(asc(invoices.dueDate));
  res.json({data:rows});
 }catch(error){next(error);}
});
financeRouter.post("/invoices",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const parsed=z.object({enrollmentId:z.uuid(),invoiceNumber:z.string().trim().min(2).max(48),description:z.string().trim().min(2).max(240),period:z.string().trim().max(32).optional(),dueDate:z.iso.date(),amountTotal:z.number().int().positive().max(1000000000)}).safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data tagihan tidak valid.",details:parsed.error.flatten()}});return;}
 try{
  const enrollment=await db.query.studentEnrollments.findFirst({where:and(eq(studentEnrollments.id,parsed.data.enrollmentId),eq(studentEnrollments.schoolId,schoolId))});
  if(!enrollment){res.status(404).json({error:{code:"ENROLLMENT_NOT_FOUND",message:"Pendaftaran siswa tidak ditemukan pada unit ini."}});return;}
  const [created]=await db.transaction(async(tx)=>{
   const rows=await tx.insert(invoices).values({...parsed.data,schoolId,status:"issued",createdBy:req.auth!.sub,issuedAt:new Date()}).returning();
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"finance.invoice_issued",entityType:"invoice",entityId:rows[0]?.id,metadata:{invoiceNumber:parsed.data.invoiceNumber,amountTotal:parsed.data.amountTotal}});
   return rows;
  });
  res.status(201).json({data:created});
 }catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"INVOICE_NUMBER_EXISTS",message:"Nomor tagihan sudah digunakan."}});return;}next(error);}
});
financeRouter.get("/payments",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 try{
  const rows=await db.select({id:payments.id,invoiceId:invoices.id,invoiceNumber:invoices.invoiceNumber,amount:payments.amount,method:payments.method,referenceNumber:payments.referenceNumber,proofUrl:payments.proofUrl,status:payments.status,createdAt:payments.createdAt,studentName:students.fullName,admissionNumber:studentEnrollments.admissionNumber})
   .from(payments).innerJoin(invoices,eq(invoices.id,payments.invoiceId)).innerJoin(studentEnrollments,eq(studentEnrollments.id,invoices.enrollmentId)).innerJoin(students,eq(students.id,studentEnrollments.studentId))
   .where(eq(payments.schoolId,schoolId)).orderBy(asc(payments.createdAt));
  res.json({data:rows});
 }catch(error){next(error);}
});
financeRouter.post("/payments",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const parsed=z.object({invoiceId:z.uuid(),amount:z.number().int().positive().max(1000000000),method:z.enum(["cash","bank_transfer","other"]),referenceNumber:z.string().trim().max(120).optional(),proofUrl:z.string().url().optional()}).safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data pembayaran tidak valid.",details:parsed.error.flatten()}});return;}
 try{
  const invoice=await db.query.invoices.findFirst({where:and(eq(invoices.id,parsed.data.invoiceId),eq(invoices.schoolId,schoolId))});
  if(!invoice||invoice.status==="cancelled"){res.status(404).json({error:{code:"INVOICE_NOT_FOUND",message:"Tagihan tidak ditemukan atau sudah dibatalkan."}});return;}
  const pending=await db.select({amount:payments.amount}).from(payments).where(and(eq(payments.invoiceId,invoice.id),eq(payments.status,"pending")));
  const reserved=pending.reduce((total,item)=>total+item.amount,0);
  const remaining=invoice.amountTotal-invoice.amountPaid-reserved;
  if(parsed.data.amount>remaining){res.status(409).json({error:{code:"PAYMENT_EXCEEDS_REMAINING",message:"Nominal pembayaran melebihi sisa tagihan yang belum dibayar."}});return;}
  const [created]=await db.transaction(async(tx)=>{
   const rows=await tx.insert(payments).values({...parsed.data,schoolId,submittedBy:req.auth!.sub,status:"pending"}).returning();
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"finance.payment_recorded",entityType:"payment",entityId:rows[0]?.id,metadata:{invoiceId:invoice.id,amount:parsed.data.amount}});
   return rows;
  });
  res.status(201).json({data:created});
 }catch(error){next(error);}
});
financeRouter.post("/payments/:paymentId/verify",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const id=z.uuid().safeParse(req.params.paymentId);if(!id.success){res.status(400).json({error:{code:"INVALID_PAYMENT_ID",message:"ID pembayaran tidak valid."}});return;}
 try{
  const payment=await db.query.payments.findFirst({where:and(eq(payments.id,id.data),eq(payments.schoolId,schoolId))});
  if(!payment){res.status(404).json({error:{code:"PAYMENT_NOT_FOUND",message:"Pembayaran tidak ditemukan."}});return;}
  if(payment.status!=="pending"){res.status(409).json({error:{code:"PAYMENT_ALREADY_PROCESSED",message:"Pembayaran sudah diproses sebelumnya."}});return;}
  const invoice=await db.query.invoices.findFirst({where:and(eq(invoices.id,payment.invoiceId),eq(invoices.schoolId,schoolId))});
  if(!invoice){res.status(404).json({error:{code:"INVOICE_NOT_FOUND",message:"Tagihan tidak ditemukan."}});return;}
  if(invoice.amountPaid+payment.amount>invoice.amountTotal){res.status(409).json({error:{code:"PAYMENT_EXCEEDS_REMAINING",message:"Verifikasi akan menyebabkan kelebihan pembayaran."}});return;}
  await db.transaction(async(tx)=>{
   await tx.update(payments).set({status:"verified",verifiedBy:req.auth!.sub,verifiedAt:new Date()}).where(eq(payments.id,payment.id));
   const amountPaid=invoice.amountPaid+payment.amount;
   await tx.update(invoices).set({amountPaid,status:amountPaid>=invoice.amountTotal?"paid":"partially_paid",updatedAt:new Date()}).where(eq(invoices.id,invoice.id));
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"finance.payment_verified",entityType:"payment",entityId:payment.id,metadata:{invoiceId:invoice.id,amount:payment.amount}});
  });
  res.json({data:{paymentId:payment.id,status:"verified",invoiceId:invoice.id,amountPaid:invoice.amountPaid+payment.amount}});
 }catch(error){next(error);}
});
financeRouter.post("/payments/:paymentId/reject",requirePermission("finance.manage"),async(req,res,next)=>{
 const schoolId=selectedSchool(req,res);if(!schoolId)return;
 const id=z.uuid().safeParse(req.params.paymentId);
 const parsed=z.object({reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
 if(!id.success||!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"ID pembayaran atau alasan penolakan tidak valid."}});return;}
 try{
  const payment=await db.query.payments.findFirst({where:and(eq(payments.id,id.data),eq(payments.schoolId,schoolId))});
  if(!payment){res.status(404).json({error:{code:"PAYMENT_NOT_FOUND",message:"Pembayaran tidak ditemukan."}});return;}
  if(payment.status!=="pending"){res.status(409).json({error:{code:"PAYMENT_ALREADY_PROCESSED",message:"Pembayaran sudah diproses sebelumnya."}});return;}
  const [updated]=await db.transaction(async(tx)=>{
   const rows=await tx.update(payments).set({status:"rejected",rejectionReason:parsed.data.reason,verifiedBy:req.auth!.sub,verifiedAt:new Date()}).where(eq(payments.id,payment.id)).returning();
   await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"finance.payment_rejected",entityType:"payment",entityId:payment.id,metadata:{reason:parsed.data.reason}});
   return rows;
  });
  res.json({data:updated});
 }catch(error){next(error);}
});
