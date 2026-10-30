import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs, globalUserRoles, roles, schoolUnits, userSchoolRoles, users } from "../../db/schema/index.js";
import { hashPassword } from "../../auth/password.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { loadAccessContext } from "../access/access-context.js";

export const usersRouter = Router();
const createUserSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(180),
  password: z.string().min(12).max(128),
  roleCode: z.enum(["school_principal", "school_admin", "teacher", "finance", "content_editor"]),
});
const assignExistingSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
  roleCode: z.enum(["school_principal", "school_admin", "teacher", "finance", "content_editor"]),
});
const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(180).optional(),
  status: z.enum(["active", "suspended", "invited"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

usersRouter.use(authenticate, loadAccessContext, requirePermission("user.manage"));

function selectedSchool(req: Request, res: Response): string | null {
  if (!req.schoolId) {
    res.status(400).json({ error: { code: "SCHOOL_CONTEXT_REQUIRED", message: "Pilih school unit melalui header x-school-id terlebih dahulu." } });
    return null;
  }
  return req.schoolId;
}

usersRouter.get("/roles", async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  try {
    const rows = await db.select({ code: roles.code, name: roles.name, description: roles.description })
      .from(roles).where(eq(roles.scope, "school"));
    res.json({ data: rows });
  } catch (error) { next(error); }
});

usersRouter.post("/parent-account", async (req,res,next)=>{
  const schoolId=selectedSchool(req,res);
  if(!schoolId)return;
  const parsed=z.object({email:z.string().trim().pipe(z.email()).transform(v=>v.toLowerCase()),fullName:z.string().trim().min(2).max(180),password:z.string().min(12).max(128)}).safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Data akun orang tua tidak valid.",details:parsed.error.flatten()}});return;}
  try{
    const parentRole=await db.query.roles.findFirst({where:and(eq(roles.code,"parent"),eq(roles.scope,"personal"))});
    if(!parentRole){res.status(409).json({error:{code:"PARENT_ROLE_MISSING",message:"Role parent belum tersedia. Jalankan seed database."}});return;}
    const [created]=await db.transaction(async(tx)=>{
      const rows=await tx.insert(users).values({email:parsed.data.email,fullName:parsed.data.fullName,passwordHash:await hashPassword(parsed.data.password),status:"active"}).returning({id:users.id,email:users.email,fullName:users.fullName,status:users.status});
      if(!rows[0])throw new Error("Parent account insert returned no row");
      await tx.insert(globalUserRoles).values({userId:rows[0].id,roleId:parentRole.id});
      await tx.insert(auditLogs).values({actorUserId:req.auth!.sub,schoolId,action:"parent.account_created",entityType:"user",entityId:rows[0].id,metadata:{email:rows[0].email}});
      return rows;
    });
    res.status(201).json({data:created});
  }catch(error){
    if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23505"){res.status(409).json({error:{code:"EMAIL_ALREADY_EXISTS",message:"Email sudah digunakan."}});return;}
    next(error);
  }
});
usersRouter.get("/", async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  try {
    const rows = await db.select({
      id: users.id, email: users.email, fullName: users.fullName, status: users.status,
      createdAt: users.createdAt, roleCode: roles.code, roleName: roles.name,
    }).from(userSchoolRoles)
      .innerJoin(users, eq(userSchoolRoles.userId, users.id))
      .innerJoin(roles, eq(userSchoolRoles.roleId, roles.id))
      .where(eq(userSchoolRoles.schoolId, schoolId));
    const grouped = new Map<string, { id: string; email: string; fullName: string; status: string; createdAt: Date; roles: { code: string; name: string }[] }>();
    for (const row of rows) {
      const existing = grouped.get(row.id) ?? { id: row.id, email: row.email, fullName: row.fullName, status: row.status, createdAt: row.createdAt, roles: [] };
      existing.roles.push({ code: row.roleCode, name: row.roleName });
      grouped.set(row.id, existing);
    }
    res.json({ data: [...grouped.values()] });
  } catch (error) { next(error); }
});

usersRouter.post("/", async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Data pengguna tidak valid.", details: parsed.error.flatten() } });
    return;
  }
  try {
    const school = await db.query.schoolUnits.findFirst({ where: eq(schoolUnits.id, schoolId) });
    if (!school || school.status !== "active") {
      res.status(404).json({ error: { code: "SCHOOL_NOT_FOUND", message: "School unit tidak ditemukan atau tidak aktif." } });
      return;
    }
    const role = await db.query.roles.findFirst({ where: and(eq(roles.code, parsed.data.roleCode), eq(roles.scope, "school")) });
    if (!role) {
      res.status(400).json({ error: { code: "ROLE_NOT_FOUND", message: "Role sekolah tidak tersedia. Jalankan seed database." } });
      return;
    }
    const existing = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
    if (existing) {
      res.status(409).json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "Email sudah digunakan. Gunakan email lain atau tambahkan role pada akun yang sudah ada." } });
      return;
    }
    const created = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        email: parsed.data.email, fullName: parsed.data.fullName,
        passwordHash: await hashPassword(parsed.data.password), status: "active",
      }).returning({ id: users.id, email: users.email, fullName: users.fullName, status: users.status });
      if (!user) throw new Error("User insert returned no row");
      await tx.insert(userSchoolRoles).values({ userId: user.id, schoolId, roleId: role.id, assignedBy: req.auth!.sub });
      await tx.insert(auditLogs).values({
        actorUserId: req.auth!.sub, schoolId, action: "user.created",
        entityType: "user", entityId: user.id,
        metadata: { email: user.email, roleCode: role.code },
      });
      return { ...user, role: { code: role.code, name: role.name } };
    });
    res.status(201).json({ data: created });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "Email sudah digunakan." } });
      return;
    }
    next(error);
  }
});

usersRouter.post("/assign-existing", async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const parsed = assignExistingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email atau role tidak valid." } });
    return;
  }
  try {
    const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
    if (!user) {
      res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "Akun belum terdaftar. Buat akun baru terlebih dahulu." } });
      return;
    }
    const role = await db.query.roles.findFirst({ where: and(eq(roles.code, parsed.data.roleCode), eq(roles.scope, "school")) });
    if (!role) {
      res.status(400).json({ error: { code: "ROLE_NOT_FOUND", message: "Role sekolah tidak tersedia." } });
      return;
    }
    const membership = await db.query.userSchoolRoles.findFirst({
      where: and(eq(userSchoolRoles.userId, user.id), eq(userSchoolRoles.schoolId, schoolId), eq(userSchoolRoles.roleId, role.id)),
    });
    if (membership) {
      res.status(409).json({ error: { code: "ROLE_ALREADY_ASSIGNED", message: "Pengguna sudah memiliki role tersebut pada unit ini." } });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.insert(userSchoolRoles).values({ userId: user.id, schoolId, roleId: role.id, assignedBy: req.auth!.sub });
      await tx.insert(auditLogs).values({
        actorUserId: req.auth!.sub, schoolId, action: "user.role_assigned",
        entityType: "user", entityId: user.id, metadata: { email: user.email, roleCode: role.code },
      });
    });
    res.status(201).json({ data: { id: user.id, email: user.email, fullName: user.fullName, status: user.status, role: { code: role.code, name: role.name } } });
  } catch (error) { next(error); }
});

usersRouter.patch("/:userId", async (req, res, next) => {
  const schoolId = selectedSchool(req, res);
  if (!schoolId) return;
  const id = z.uuid().safeParse(req.params.userId);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "ID atau data pengguna tidak valid." } });
    return;
  }
  try {
    const membership = await db.query.userSchoolRoles.findFirst({
      where: and(eq(userSchoolRoles.userId, id.data), eq(userSchoolRoles.schoolId, schoolId)),
    });
    if (!membership) {
      res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan pada school unit ini." } });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      const [user] = await tx.update(users).set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(users.id, id.data))
        .returning({ id: users.id, email: users.email, fullName: users.fullName, status: users.status });
      await tx.insert(auditLogs).values({
        actorUserId: req.auth!.sub, schoolId, action: "user.updated",
        entityType: "user", entityId: id.data, metadata: parsed.data,
      });
      return user;
    });
    res.json({ data: updated });
  } catch (error) { next(error); }
});
