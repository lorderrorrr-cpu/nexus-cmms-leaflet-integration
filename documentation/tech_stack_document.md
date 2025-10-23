# Tech Stack Document for Nexus CMMS

This document explains the technology choices behind the **nexus-cmms-leaflet-integration** project. It’s written in simple terms so anyone—technical or not—can understand why each tool and service was picked and how they work together.

## 1. Frontend Technologies

Our user interface (what you see and interact with in the browser) is built with modern, popular web tools:

- **Next.js (App Router)**
  - Provides a solid foundation for server-side rendering and fast page loads.
  - Supports building a Progressive Web App (PWA) so technicians can use key features even when offline.
- **React**
  - Powers the interactive parts of the UI, like forms, tables, and maps.
  - Its component-based approach makes it easy to reuse pieces across different screens.
- **TypeScript**
  - Adds a layer of safety by checking types in code before it runs, reducing bugs.
- **shadcn/ui**
  - A ready-made library of design components (buttons, tables, dropdowns, charts).
  - Ensures a consistent look and feel and speeds up interface development.
- **Tailwind CSS**
  - A utility-first styling framework that makes it quick to tweak layouts, colors, and spacing without writing custom CSS from scratch.
- **react-leaflet**
  - Integrates interactive maps into React components, powering the live ticket map, location views, and GPS checks.
- **Zustand (optional state library)**
  - Manages global state (for example, map filters or authenticated user info) in a lightweight way, without the boilerplate of larger state frameworks.

These tools work together to deliver a fast, responsive, and visually consistent experience—whether you’re on a desktop in the office or a tablet out in the field.

## 2. Backend Technologies

The backend handles data storage, business logic, and API endpoints that the frontend calls:

- **Next.js API Routes**
  - Let us build all server-side logic directly within the same codebase.
  - Keep ticketing, asset management, and workflow logic in one place, reducing complexity and external dependencies.
- **Better Auth**
  - Manages user sign-up, sign-in, sessions, and role-based access control (RBAC).
  - Ensures only Admins, Supervisors, Technicians, or Viewers can see or act on their authorized data.
- **PostgreSQL**
  - A reliable relational database that stores all core records: locations (TIDs), assets, tickets, users, roles, and SLAs.
  - Well-suited for complex data relationships and reporting needs.
- **Drizzle ORM**
  - A modern, type-safe way to define and query the database from TypeScript code.
  - Guarantees that our code and our database schema stay in sync and prevents common data mismatch bugs.
- **pdf-lib or Puppeteer**
  - Generates printable jobcard PDFs automatically when tickets close.
  - Provides a consistent, shareable service record for each job.

By keeping backend logic inside Next.js and using a type-safe ORM, we achieve a coherent, maintainable codebase that’s easier to test and extend.

## 3. Infrastructure and Deployment

To deploy and operate the application reliably, we’ve chosen containerization, automated workflows, and version control:

- **Docker**
  - Packages the entire application (frontend, backend, and database connection) into a container that runs the same everywhere.
  - Eliminates "it works on my machine" issues and ensures consistency across development, staging, and production.
- **Git & GitHub**
  - Version control system to track all code changes, collaborate with team members, and maintain a clear history.
- **GitHub Actions (CI/CD)**
  - Automates testing, building, and deployment whenever code is pushed or a pull request is merged.
  - Ensures that new features and fixes go live quickly and safely.
- **Environment Variables**
  - Securely store sensitive settings (database URLs, API keys) outside the codebase.
  - Allows us to change configurations per environment (development, testing, production) without code changes.
- **Cron Jobs (e.g., Vercel Cron)**
  - Schedules recurring tasks like generating preventive maintenance tickets based on predefined plans.

This setup makes the system easy to update, scales with our needs, and guarantees predictable deployments.

## 4. Third-Party Integrations

We rely on select external services and libraries to speed up development and add critical features:

- **Better Auth** for authentication and role management.
- **react-leaflet** (and Leaflet) for interactive mapping and spatial analytics.
- **pdf-lib or Puppeteer** for on-the-fly PDF generation of jobcards.
- **Vercel Cron or similar scheduler** for automated maintenance ticket creation.
- **Zustand** (optional) for streamlined state management on complex pages like live dashboards.

Each integration was chosen because it fits seamlessly with Next.js, offers strong community support, and addresses a core feature need without reinventing the wheel.

## 5. Security and Performance Considerations

We’ve built security and speed into the stack from the start:

- **Role-Based Access Control (RBAC)**
  - Better Auth enforces who can view or modify data based on their role.
  - Limits risk by ensuring least-privilege access.
- **HTTPS Everywhere**
  - All traffic is served over secure connections to protect data in transit.
- **Type Checking with TypeScript & Drizzle**
  - Catches many potential bugs before deployment, reducing runtime errors.
- **Server-Side Rendering (SSR) & Caching**
  - Next.js fetches critical data on the server for faster initial page loads and SEO benefits.
- **Progressive Web App (PWA) Features**
  - Service worker and caching strategies let technicians continue working offline and sync data when back online.
- **Database Constraints & Transactions**
  - PostgreSQL enforces data integrity rules (foreign keys, unique indexes).
  - Drizzle ORM uses transactions for multi-step operations, preventing partial updates.
- **CI/CD Testing**
  - Automated unit tests (Jest) and end-to-end tests (Playwright/Cypress) run on every change to catch regressions early.

These layers of security and optimization ensure that users have a smooth experience and that the system remains robust against common threats and performance bottlenecks.

## 6. Conclusion and Overall Tech Stack Summary

To build the Nexus CMMS with real-time maps, robust ticketing, and enterprise workflows, we’ve chosen a unified JavaScript/TypeScript stack centered on Next.js. Key takeaways:

- Frontend: Next.js + React + TypeScript + Tailwind + shadcn/ui + react-leaflet
- Backend: Next.js API Routes + Better Auth + PostgreSQL + Drizzle ORM + PDF generation
- Infrastructure: Docker + GitHub Actions CI/CD + Environment Variables + Cron scheduler
- Security & Performance: RBAC, HTTPS, SSR, PWA offline support, type-safe code, automated testing

This combination aligns perfectly with our goals of rapid development, high data integrity, a seamless user experience, and the ability to extend the platform—whether adding advanced dispatch maps, dynamic form builders, or new reporting dashboards. The Nexus CMMS is built to scale, evolve, and keep field teams productive in any environment.