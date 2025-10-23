# Nexus CMMS Security Guideline Document

This security guideline document provides a set of best practices and architectural recommendations to secure the `nexus-cmms-leaflet-integration` codebase from design through deployment. It aligns with core principles—Security by Design, Least Privilege, Defense in Depth, and Fail Securely—to ensure a robust, resilient, and maintainable CMMS platform.

---

## 1. Secure Architecture Overview

- **Security by Design**: Integrate these controls from day one. Every new module (RBAC, Dashboard, API routes, Leaflet maps) must comply with these guidelines.
- **Defense in Depth**: Apply multiple layers of protection—from network (TLS, firewalls) to application (input validation, headers) to data (encryption, access control).
- **Least Privilege**: Grant only the minimum permissions to roles, services, and database users.

---

## 2. Authentication & Role-Based Access Control (RBAC)

### 2.1. Authentication Hardening

- Use **Better Auth** with strong password policies:
  - Minimum 12-character length, mix of uppercase, lowercase, digits, symbols.
  - Enforce password rotation or expiry for high-privilege accounts.
  - Hash with Argon2 or bcrypt + unique salt per user.
- **Multi-Factor Authentication (MFA)**:
  - Encourage or require MFA for Admin and Supervisor roles.
  - Offer TOTP (Google Authenticator) or SMS/email OTP as a second factor.
- **Session Management**:
  - Use secure, random session IDs or JWTs with strong secret keys.
  - Enforce idle timeout (e.g., 15 min) and absolute session timeout (e.g., 8 hours).
  - Implement logout endpoint to invalidate sessions/JWT.
  - Protect against session fixation by rotating session IDs on login.

### 2.2. Role-Based Access Control

- Define roles clearly: `Admin`, `Supervisor`, `Technician`, `Viewer`.
- Perform **server-side** authorization checks on every API route and page:
  - Middleware in Next.js (`/middleware.ts`) to block unauthorized paths.
  - Validate JWT `exp`, `iss`, `aud`, and custom `role` claims.
- Use **least privilege** in feature flags. Example:
  - Technician can only CRUD their own tickets.
  - Supervisor can view/assign across teams but not modify global settings.

---

## 3. Data Protection & Privacy

### 3.1. Encryption & Secrets Management

- **Data in Transit**: Enforce HTTPS (TLS 1.2+) for all frontend-backend and database connections. Redirect HTTP → HTTPS via `Strict-Transport-Security` header.
- **Data at Rest**: Encrypt sensitive fields (PII, credentials) in the PostgreSQL database using an encrypting column store or application-level AES-256.
- **Secrets Management**:
  - Do **not** check secrets (DB URLs, API keys) into source control.
  - Use a vault solution (AWS Secrets Manager, HashiCorp Vault) or encrypted environment variables via `.env` files with restricted access.

### 3.2. Data Minimization & Privacy

- Return only necessary fields in API responses (avoid PII leakage).
- Mask or redact sensitive data in logs (e.g., user passwords, tokens).
- Implement GDPR/CCPA compliance:
  - Data retention policies for ticket history and user accounts.
  - Right to access, rectify, and delete personal data.

---

## 4. Input Validation & Output Encoding

- **Server-Side Validation** (never rely solely on client-side):
  - Use Zod or Joi schemas for all API inputs.
  - Sanitize and validate JSON bodies, query parameters, and headers.
- **Prevent Injection Attacks**:
  - Use Drizzle ORM parameterized queries—avoid raw SQL.
  - Sanitize any dynamic expressions before use in DB or shell commands.
- **Prevent XSS**:
  - Escape user content in React server components by default.
  - Implement a strict **Content-Security-Policy** restricting `script-src` and `style-src`.
- **Redirects & Forwards**:
  - Validate target URLs against an allow-list to avoid open redirect issues.
- **File Uploads** (if any):
  - Validate MIME type, extension, and file size.
  - Store uploads outside the public webroot; serve via signed URLs.

---

## 5. API & Service Security

- **HTTPS Only**: Ensure `next.config.js` and hosting enforce TLS.
- **Rate Limiting & Throttling**:
  - Implement per-IP and per-user rate limits on auth endpoints and high-risk APIs.
- **CORS**:
  - Restrict `Access-Control-Allow-Origin` to known origins (e.g., your corporate domain).
- **HTTP Methods**:
  - Validate and enforce correct verbs (GET for reads, POST for creations, PUT/PATCH for updates, DELETE for removals).
- **API Versioning**:
  - Prefix routes (e.g., `/api/v1/cmms/tickets`) to allow safe iteration.

---

## 6. Web Application Security Hygiene

- **Security Headers**:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'none'`
  - `Referrer-Policy: no-referrer-when-downgrade`
- **CSRF Protection**:
  - Use anti-CSRF tokens (e.g., NextAuth’s CSRF or custom synchronizer tokens) on all state-changing forms.
- **Secure Cookies**:
  - Set `HttpOnly`, `Secure`, and `SameSite=Strict` on session cookies.
- **Subresource Integrity (SRI)** for any CDN-loaded assets.
- **Disable Client-Side Storage** of sensitive tokens—never store JWTs in `localStorage`.

---

## 7. Infrastructure & Deployment Security

- **Container Hardening** (Docker):
  - Use minimal base images (e.g., `node:lts-alpine`).
  - Drop unnecessary Linux capabilities and run as non-root user.
- **CI/CD Pipeline Security**:
  - Secure pipeline credentials in vaults.
  - Scan for secrets in commits (e.g., GitHub secret scanning).
  - Automate vulnerability scans (Snyk, Trivy) on Docker images and dependencies.
- **Network & Firewall**:
  - Restrict database access to the application subnet via security groups or firewall rules.
- **TLS Configuration**:
  - Disable TLS 1.0/1.1 and weak ciphers (RC4, 3DES).
  - Use strong suites (AES-GCM, ECDHE).

---

## 8. Dependency Management

- **Lockfiles & Pinning**:
  - Commit `package-lock.json` and enforce deterministic installs.
- **Vulnerability Scanning**:
  - Integrate SCA in CI (e.g., GitHub Dependency Review, OWASP Dependency-Check).
- **Minimal Footprint**:
  - Remove unused packages.
  - Vet third-party libraries for maintenance and CVE history.

---

## 9. Leaflet Integration Security Considerations

- **Map Tile Sources**:
  - Serve tiles over HTTPS only.
  - Enable SRI and/or Content Security Policy rules for tile and plugin scripts.
- **User-Provided GeoJSON**:
  - Validate shapes and sanitize properties to prevent injection in map popups.
- **Client-Side Performance**:
  - Lazy-load map components and use clustering to avoid DoS via large marker sets.

---

## 10. CI/CD & Testing Strategy

- **Automated Testing**:
  - Unit tests (Jest) covering business logic (SLA calculations, authorization middleware).
  - Integration tests for API routes interacting with a test database (use a Docker container).
  - End-to-end tests (Playwright/Cypress) for key flows (login, ticket creation, map display).
- **Continuous Monitoring**:
  - Integrate static analysis (ESLint, TypeScript strict mode) and security linting (eslint-plugin-security).
  - Generate coverage and vulnerability reports as part of CI.

---

## 11. Ongoing Security Practices & Governance

- Schedule quarterly penetration tests and code reviews focused on security.
- Maintain an up-to-date threat model as features (Leaflet, PDF engine, offline PWA) evolve.
- Provide security training for developers on OWASP Top 10 and secure Next.js patterns.
- Establish incident response plan and logging/monitoring (audit logs for ticket changes, admin actions).

---

By following these guidelines, the `nexus-cmms-leaflet-integration` codebase will be fortified against common threats and prepared for enterprise-grade compliance and resilience. Security is an ongoing process—regularly review and update controls as the application and threat landscape evolve.