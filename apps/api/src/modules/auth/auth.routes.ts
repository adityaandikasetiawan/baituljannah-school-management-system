import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { verifyPassword } from "../../auth/password.js";
import { signAccessToken } from "../../auth/token.js";
import { authenticate } from "../../middleware/authenticate.js";
export const authRouter = Router();
const loginSchema = z.object({ email: z.email().transform((v) => v.trim().toLowerCase()), password: z.string().min(1).max(128) });
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid login payload", details: parsed.error.flatten() } }); return; }
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user || user.status !== "active" || !(await verifyPassword(parsed.data.password, user.passwordHash))) { res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } }); return; }
  res.json({ accessToken: signAccessToken({ sub: user.id, email: user.email }), user: { id: user.id, email: user.email, fullName: user.fullName } });
});
authRouter.get("/me", authenticate, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.auth!.sub) });
  if (!user || user.status !== "active") { res.status(401).json({ error: { code: "USER_INACTIVE", message: "User is not active" } }); return; }
  res.json({ id: user.id, email: user.email, fullName: user.fullName });
});
