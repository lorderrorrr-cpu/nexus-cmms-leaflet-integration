# Project Requirements Document (PRD)

## 1. Project Overview

Nexus CMMS Leaflet Integration is the next step in building the Nexus Computerized Maintenance Management System (CMMS), a standalone platform for managing IT device–related services. Its core purpose is to provide an integrated dashboard that combines ticketing, asset management, and real-time spatial intelligence. Developers will build upon the existing Next.js scaffold—complete with authentication, UI components, and a type-safe database—to add interactive maps via Leaflet and React-Leaflet. This will empower operations teams with live location tracking of service tickets and assets.

We’re building this feature to solve the problem of limited situational awareness in traditional CMMS platforms. By visualizing active tickets and asset locations on a map, supervisors and technicians can respond faster, optimize dispatch routes, and validate field data. Success criteria include: a working login and RBAC system; a dashboard page displaying a clustered, real-time ticket map; a location management view that plots all facility points; and GPS verification embedded in ticket forms.

## 2. In-Scope vs. Out-of-Scope

**In-Scope (Version 1):**
- Secure user authentication and role-based access control (Admin, Supervisor, Technician, Viewer).
- Protected dashboard layout with sidebar navigation.
- Leaflet map integration (using react-leaflet) with:
  - Live Ticket Map: clustered markers showing open tickets.
  - Location Map View: plotting Master Lokasi (TID) points under “Master Data.”
  - GPS Verification Map: small map widget in ticket creation forms comparing technician’s GPS vs. site coordinates.
- Core modules: Master Data Management (locations & assets), Ticketing CRUD, and basic Reporting & Analytics placeholder.
- Backend API routes for tickets, assets, locations, and user roles (Next.js API Routes + Drizzle ORM).
- Database schema definitions (Drizzle + PostgreSQL) for locations, assets, tickets, users, roles.

**Out-of-Scope (Planned for Phase 2+):**
- Smart Dispatch Map (real-time technician assignment optimization).
- Dynamic Form Builder with JSON-driven forms.
- Preventive Maintenance Scheduling engine (cron jobs).
- PDF Jobcard Generation Engine.
- Full PWA/offline support with service workers.
- End-to-end automated testing and CI/CD pipeline.

## 3. User Flow

A technician or manager visits the CMMS URL and lands on the sign-in page. They enter credentials, which are verified through the Better Auth service. Upon successful login, the user is routed to the main dashboard. The left sidebar displays navigation links—Dashboard, Master Data, Tickets, Reports, and Profile—tailored to their role.

On the Dashboard screen, the user sees a Leaflet map with clustered ticket markers. Clicking a cluster zooms in to reveal individual tickets; clicking a marker opens a side panel with ticket details. From the sidebar, they can go to Master Data → Location Map to view all facility points on a full-screen map. To create or edit a ticket, they navigate to Tickets → New Ticket form, which includes a GPS Verification map showing current GPS vs. stored site coordinates. After submission, the ticket appears on the live map in near real time.

## 4. Core Features

- **Authentication & RBAC:** Secure sign-in, session management, and four user roles.
- **Dashboard Module:** Protected route with sidebar and server-rendered layout.
- **Leaflet Map Integration:** React-Leaflet components for live ticket map, location view, and GPS verification.
- **Master Data CRUD:** Create, read, update, delete for Locations (TID) and Assets.
- **Ticketing Engine:** Ticket creation, listing, detail view, and status updates.
- **API Layer:** Next.js API Routes for all CRUD operations, powered by Drizzle ORM.
- **Database Layer:** PostgreSQL schemas for users, roles, locations, assets, tickets.
- **UI Component Library:** shadcn/ui + Tailwind CSS for tables, inputs, dropdowns, charts.

## 5. Tech Stack & Tools

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Mapping:** Leaflet, React-Leaflet
- **Authentication:** Better Auth library
- **Backend:** Next.js API Routes, TypeScript
- **Database:** PostgreSQL, Drizzle ORM
- **Containerization:** Docker
- **Testing (future):** Jest for unit, Playwright/Cypress for E2E
- **Deployment (future):** GitHub Actions for CI/CD

## 6. Non-Functional Requirements

- **Performance:** API response time <200ms; initial dashboard load <2s; map tile load <1s.
- **Security:** Encrypted HTTPS all endpoints; role-based access enforced in API and UI; environment variables for secrets.
- **Scalability:** Marker clustering for maps; type-safe ORM to prevent schema drift.
- **Usability:** Responsive design for desktop and tablet; accessible components (WCAG AA).
- **Reliability:** 99.9% uptime; automated backups of PostgreSQL database.

## 7. Constraints & Assumptions

- The PostgreSQL server is reachable at the provided network address.
- Leaflet and React-Leaflet can be dynamically imported to avoid SSR issues in Next.js.
- Better Auth sessions will handle JWT tokens and auto-refresh.
- No external mapping APIs (e.g., Mapbox) will be used—only open-source Leaflet tiles.
- The environment supports Docker and TypeScript.

## 8. Known Issues & Potential Pitfalls

- **SSR & Leaflet:** Leaflet relies on `window`. Mitigation: dynamically import map components with `next/dynamic` and disable SSR.
- **Marker Performance:** Too many markers can slow the client. Mitigation: use clustering and viewport-based loading.
- **API Rate Limits:** Internal API calls must be throttled if volume spikes. Mitigation: simple in-memory rate limiting or caching layer.
- **Schema Migration Drift:** Changing Drizzle schema without migrations can cause mismatches. Mitigation: establish a migration workflow (e.g., Drizzle migrations).
- **GPS Accuracy:** Device GPS may report low accuracy. Mitigation: show accuracy radius on GPS Verification map and warn users.

---

This PRD provides a clear, unambiguous blueprint for building the Leaflet integration into the Nexus CMMS scaffold. All details are defined so that subsequent technical documents can be drafted without further clarification.