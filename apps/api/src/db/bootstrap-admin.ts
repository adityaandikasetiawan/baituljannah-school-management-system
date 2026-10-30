import "dotenv/config";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { db, pool } from "./client.js";
import { globalUserRoles, roles, users } from "./schema/index.js";

const input = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  fullName: z.string().trim().min(2).max(180),
  password: z.string().min(14).max(128),
});
async function bootstrap() {
  const parsed = input.safeParse({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    fullName: process.env.BOOTSTRAP_ADMIN_NAME,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  });
  if (!parsed.success) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and a 14+ character BOOTSTRAP_ADMIN_PASSWORD before running this command.");
  const superAdmin = await db.query.roles.findFirst({ where: eq(roles.code, "super_admin") });
  if (!superAdmin) throw new Error("Role catalog is missing. Run pnpm db:seed first.");
  const existingAssignments = await db.select({ userId: globalUserRoles.userId })
    .from(globalUserRoles).where(eq(globalUserRoles.roleId, superAdmin.id)).limit(1);
  if (existingAssignments.length) throw new Error("A Super Admin already exists. Bootstrap is disabled after the first administrator is assigned.");
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (existingUser) throw new Error("This email already belongs to a user. Use the controlled user-invitation flow instead.");
  await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: await hashPassword(parsed.data.password),
      status: "active",
    }).returning();
    if (!user) throw new Error("Could not create the administrator user.");
    await tx.insert(globalUserRoles).values({ userId: user.id, roleId: superAdmin.id });
  });
  console.info(`Initial Super Admin created: ${parsed.data.email}`);
}
bootstrap().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
