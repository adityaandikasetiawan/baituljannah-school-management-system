# Security baseline

- Passwords are bcrypt-hashed; plaintext credentials are never stored.
- Access tokens are short-lived. Refresh-token rotation/revocation is a required follow-up before production.
- Validate request bodies and parameters with Zod.
- Apply authentication, permission, and school membership checks on the server.
- Never treat a client-supplied school ID as proof of access.
- Log security-relevant actions without passwords, tokens, or sensitive student data.
- Production requires HTTPS, secure headers, rate limits, strict CORS, secure token storage, least-privilege database credentials, backups, and monitoring.
- PostgreSQL row-level security is a defense-in-depth hardening item; application tenant scoping is mandatory now.
- CMS documents must be schema-validated; disallow arbitrary scripts, event handlers, and unsafe URLs.
- Do not expose private records through public website routes.

This is a development foundation, not a security certification. Threat modeling, penetration testing, backup/restore drills, and privacy review are required before launch.
