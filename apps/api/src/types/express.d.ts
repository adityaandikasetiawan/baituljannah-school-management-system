import type { AccessTokenClaims } from "../auth/token.js";
declare global { namespace Express { interface Request { auth?: AccessTokenClaims; schoolId?: string } } }
export {};
