import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export interface AccessTokenClaims { sub: string; email: string }
export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"] });
}
export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.email !== "string") throw new Error("Invalid access token claims");
  return { sub: decoded.sub, email: decoded.email };
}
