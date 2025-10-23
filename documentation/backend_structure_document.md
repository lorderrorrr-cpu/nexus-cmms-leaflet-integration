# Backend Structure Document for Nexus CMMS

This document outlines the backend architecture, database management, schema design, API endpoints, hosting, infrastructure, security, and maintenance strategies used in the `nexus-cmms-leaflet-integration` project. It is written in everyday language to ensure clarity for both technical and non-technical readers.

## 1. Backend Architecture

**Overall Design**  
- The backend is built into Next.js using its API Routes. This means that all server logic lives alongside the frontend code in a single monorepo, but runs separately on the server.  
- We use TypeScript throughout for clear contracts, fewer bugs, and easier refactoring.  
- Drizzle ORM sits between our code and PostgreSQL to provide type-safe database interactions.

**Key Patterns and Frameworks**  
- Next.js API Routes: Handles HTTP requests (GET, POST, PUT, DELETE) under `/app/api`.  
- Better Auth: Manages user sessions, password hashing, and token strategies for Role-Based Access Control (RBAC).  
- Docker: Encapsulates the backend in containers for consistent environments from development through production.

**Scalability, Maintainability, Performance**  
- Stateless API design: Each request is independent, so we can add more containers (horizontal scaling) behind a load balancer.  
- Modular code structure: Authentication, ticketing, assets, and reporting each live in their own folders. This makes it simple to onboard new developers or extend features.  
- Type safety (TypeScript + Drizzle): Catch errors at compile time, leading to fewer runtime surprises and faster development cycles.

## 2. Database Management

**Technologies Used**  
- Relational Database: PostgreSQL  
- ORM: Drizzle ORM (type-safe, code-first migrations)  
- Connection Pooling: Managed via the Postgres driver built into Next.js, with environment-based pool size settings.

**Data Structure & Access**  
- Normalized tables store users, roles, locations, assets, tickets, SLA rules, approvals, and audit logs.  
- Drizzle’s migrations keep the schema in sync with the code, and versioned migration files allow safe upgrades.  
- Indexes on key columns (e.g., ticket status, asset ID) speed up queries in the dashboards.

**Data Practices**  
- Regular automated backups (nightly snapshots) of the production database.  
- Read-replica for reporting queries, keeping the primary database fast for transactional workloads.

## 3. Database Schema

Below is a human-friendly overview, followed by the actual SQL definitions.

**Human-Readable Overview**  
- **Users & Roles**: Users sign in, and each user has one or more roles (Admin, Supervisor, Technician, Viewer).  
- **Locations**: Known as TIDs (Tenant Installation Device), with address and GPS coordinates.  
- **Assets**: Equipment or devices located at a TID.  
- **Tickets**: Work orders of types PM (Preventive Maintenance) or CM (Corrective Maintenance) linked to an asset and a technician.  
- **SLA Matrices**: Rules defining target response and fix times by ticket type and priority.  
- **Approvals & Audit Logs**: Tracks when a supervisor or manager approves ticket closure and logs every change.

**SQL Schema (PostgreSQL)**  ```sql
-- Users and Roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL  -- e.g. Admin, Technician
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
  user_id INT REFERENCES users(id),
  role_id INT REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

-- Locations (Master Lokasi/TID)
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,  -- TID code
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets (Master Asset)
CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  location_id INT REFERENCES locations(id) ON DELETE CASCADE,
  tag VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  purchase_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA Matrices
CREATE TABLE sla_matrices (
  id SERIAL PRIMARY KEY,
  ticket_type VARCHAR(50) NOT NULL,    -- PM or CM
  priority VARCHAR(50) NOT NULL,       -- e.g. High, Medium, Low
  response_target INTERVAL NOT NULL,    -- e.g. '2 hours'
  resolution_target INTERVAL NOT NULL,  -- e.g. '24 hours'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  asset_id INT REFERENCES assets(id) ON DELETE SET NULL,
  created_by INT REFERENCES users(id),
  assigned_to INT REFERENCES users(id),
  ticket_type VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals
CREATE TABLE approvals (
  id SERIAL PRIMARY KEY,
  ticket_id INT REFERENCES tickets(id) ON DELETE CASCADE,
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  comments TEXT
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,  -- e.g. 'ticket', 'asset'
  entity_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,       -- e.g. 'create', 'update'
  performed_by INT REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  change_summary JSONB
);
```  

## 4. API Design and Endpoints

We follow RESTful conventions, grouping endpoints under `/api/{resource}`. All responses use JSON.

**Authentication**  
- **POST /api/auth/signup**: Register a new user (email, password).  
- **POST /api/auth/login**: Sign in and start a session.  
- **POST /api/auth/logout**: End session.

**Users & Roles**  
- **GET /api/users**: List all users (Admin only).  
- **PUT /api/users/:id**: Update user info or roles.  
- **DELETE /api/users/:id**: Remove a user.

**Locations**  
- **GET /api/locations**: List all locations/TIDs.  
- **POST /api/locations**: Add a new location.  
- **PUT /api/locations/:id**: Update location details.  
- **DELETE /api/locations/:id**: Remove a location.

**Assets**  
- **GET /api/assets**: List or filter assets.  
- **POST /api/assets**: Register a new asset.  
- **PUT /api/assets/:id**: Update asset data.  
- **DELETE /api/assets/:id**: Decommission an asset.

**Tickets**  
- **GET /api/tickets**: List tickets with filters (status, priority).  
- **POST /api/tickets**: Create a new PM or CM ticket.  
- **PUT /api/tickets/:id**: Update status, assign technician.  
- **DELETE /api/tickets/:id**: Cancel ticket.

**SLA Matrices**  
- **GET /api/sla**: List SLA rules.  
- **POST /api/sla**: Create or update SLA targets.

**Approvals**  
- **POST /api/approvals**: Supervisor approves ticket closure.  
- **GET /api/approvals/:ticketId**: View approval history.

**Maps & Spatial Data**  
- **GET /api/maps/live-tickets**: Returns geo-coordinates and status of active tickets for the dashboard.  
- **GET /api/maps/locations**: Returns all TID locations for the location map.

**PDF Generation**  
- **POST /api/pdf/jobcard**: Generates and returns a PDF jobcard for a closed ticket.

## 5. Hosting Solutions

**Primary Hosting**  
- We deploy Dockerized containers to AWS Elastic Container Service (ECS) on Fargate for easy scaling and zero server maintenance.  
- PostgreSQL runs on Amazon RDS with Multi-AZ for failover and automated backups.

**Benefits**  
- **Reliability**: Managed services reduce downtime.  
- **Scalability**: Fargate auto-scales containers based on CPU/memory.  
- **Cost-Effectiveness**: Pay for what you use; no idle servers.

## 6. Infrastructure Components

- **Load Balancer**: AWS Application Load Balancer (ALB) distributes traffic across containers.  
- **Caching**: Redis via Amazon ElastiCache for session data caching and frequently read ticket or SLA data.  
- **CDN**: Amazon CloudFront caches static assets (PDF templates, map tiles) for faster load times worldwide.  
- **Networking**: All services run in a VPC with public/private subnets and strict security group rules.  
- **Container Registry**: AWS ECR stores Docker images with version tagging.

## 7. Security Measures

- **Authentication & Authorization**: Better Auth handles secure password storage (bcrypt), session cookies, and JWTs. RBAC enforces who can access which endpoints.  
- **Encryption**: TLS everywhere in transit, Amazon RDS encryption at rest, and encrypted S3 buckets for PDF storage.  
- **Secrets Management**: AWS Secrets Manager or environment variables stored securely in ECS Task Definitions.  
- **OWASP Best Practices**: Input validation, rate limiting on login, and regular dependency audits.

## 8. Monitoring and Maintenance

- **Logging**: Application logs shipped to Amazon CloudWatch Logs. Error tracking via Sentry.  
- **Metrics**: Container and database metrics in CloudWatch; custom business KPIs pushed via Prometheus/Grafana.  
- **Health Checks**: ALB health checks on `/api/health`. Automatic restarts on failures.  
- **Backups & Migrations**: Nightly RDS snapshots; Drizzle ORM migrations run in CI/CD pipeline.  
- **CI/CD**: GitHub Actions build Docker images, run tests (Jest, Playwright), and deploy to ECS on merge to main.

## 9. Conclusion and Overall Backend Summary

This backend is a modern, containerized, API-driven system designed to power the Nexus CMMS with high reliability, strong data integrity, and clear scalability paths.  
- **Type-Safe Data Layer** (Drizzle + PostgreSQL) ensures every database transaction matches the code’s expectations.  
- **Internal-First API** (Next.js Routes) centralizes business logic and simplifies development and testing.  
- **Future-Ready**: Infrastructure and patterns are in place to add real-time spatial intelligence (Leaflet maps), automated PM scheduling, dynamic forms, and robust PDF generation without major rewrites.  

Overall, this backend structure aligns tightly with Nexus’s goals for secure, real-time operations, and provides a rock-solid foundation for the full CMMS feature set.