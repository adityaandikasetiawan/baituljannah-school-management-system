import type { RequestHandler } from "express";
import { verifyAccessToken } from "../auth/token.js";
export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); return; }
  try { req.auth = verifyAccessToken(header.slice(7)); next(); }
  catch { res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Access token is invalid or expired" } }); }
};
