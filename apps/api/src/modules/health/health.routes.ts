import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
export const healthRouter = Router();
healthRouter.get("/", async (_req, res) => { try { await db.execute(sql`select 1`); res.json({ status: "ok", service: "baituljannah-api", database: "connected", timestamp: new Date().toISOString() }); } catch { res.status(503).json({ status: "degraded", service: "baituljannah-api", database: "unavailable" }); } });
