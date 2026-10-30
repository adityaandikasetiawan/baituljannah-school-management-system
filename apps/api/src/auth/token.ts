import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export interface AccessTokenClaims { sub: string; email: string }
function ttlToSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error("JWT_ACCESS_TTL must use s, m, h, or d units (for example 15m)");
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as "s" | "m" | "h" | "d"];
  return amount * multiplier;
}
export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL) });
}
export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.email !== "string") throw new Error("Invalid access token claims");
  return { sub: decoded.sub, email: decoded.email };
}
