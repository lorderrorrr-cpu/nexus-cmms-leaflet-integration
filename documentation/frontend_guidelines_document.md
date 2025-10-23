# Frontend Guideline Document for Nexus CMMS Leaflet Integration

This document outlines the architecture, design principles, and technologies behind the Nexus CMMS frontend. It uses everyday language to make sure everyone—from designers to new developers—can understand how the frontend is built and why.

---

## 1. Frontend Architecture

**Frameworks & Libraries**
- **Next.js (App Router)**: Our core framework. It gives us file-based routing, server-side rendering (SSR), server components, and built-in API routes.  
- **React**: Under the hood of Next.js, for composing UI.  
- **TypeScript**: Strong typing throughout the codebase, reducing runtime errors and improving IDE support.  
- **shadcn/ui**: A pre-built, accessible component library (tables, inputs, charts, dropdowns).  
- **Tailwind CSS**: Utility-first styling that keeps our CSS small and consistent.  
- **react-leaflet**: For interactive maps (planned feature).  

**How It Supports Our Goals**
- **Scalability**: The App Router lets us break features into folders (`/app/master-data`, `/app/tickets`), each with its own layout and pages. This keeps growing the code organized.  
- **Maintainability**: TypeScript + Drizzle ORM (on the backend) ensures every piece of data has a type, so changes don’t break unrelated parts. Reusable UI components from `shadcn/ui` avoid reinventing the wheel.  
- **Performance**: SSR and server components speed up initial page loads. Next.js’s built-in image and asset optimizations help keep bundle sizes small. We’ll also use code splitting and dynamic imports for heavy features (like maps).

---

## 2. Design Principles

1. **Usability**: Interfaces should be intuitive. We use clear labels, consistent layouts, and obvious calls to action.  
2. **Accessibility**: All interactive components meet WCAG standards. We leverage `shadcn/ui` for ARIA-ready elements and follow semantic HTML best practices.  
3. **Responsiveness**: Mobile-first CSS with Tailwind ensures the UI adapts smoothly from phone to desktop.  
4. **Consistency**: A unified look and feel—same spacing, typography, and color usage—across all pages and widgets.  
5. **Progressive Enhancement**: Core functionality works without JavaScript disabled. Extra interactivity (maps, real-time updates) layers on top.

**Applying These Principles**
- Forms have clear labels and error messages.  
- Dashboard widgets adapt their layout based on screen size.  
- Keyboard navigation and focus states are verified for every component.

---

## 3. Styling and Theming

**Styling Approach**
- **Tailwind CSS**: Utility classes in the JSX keep styles co-located with markup. No large, custom CSS files.  
- **Custom CSS Modules**: For very specific tweaks or animations, we use scoped CSS modules alongside Tailwind.  

**Theming**
- Defined in `tailwind.config.ts`: colors, font sizes, breakpoints.  
- Supports light and dark mode via the `class` strategy (adding `dark` to `<html>`).  

**Visual Style**
- Modern, flat design with subtle shadows for depth.  
- Cards and panels feature a light glassmorphism effect (soft, semi-transparent backgrounds) to highlight dashboard widgets.  

**Color Palette**
- **Primary**: #2563EB (blue-600)  
- **Secondary**: #059669 (green-600)  
- **Accent**: #D97706 (amber-600)  
- **Neutral Light**: #F3F4F6 (gray-100)  
- **Neutral Dark**: #111827 (gray-900)  

**Typography**
- **Font Family**: Inter (with system-ui fallback).  
- **Headings**: 600 weight.  
- **Body**: 400 weight, optimized for readability.

---

## 4. Component Structure

We follow a **component-based architecture** to build reusable UI pieces. Components live under `/components/ui` and are organized like this:

- **Atoms**: Basic elements (Button, Input, Card)  
- **Molecules**: Combinations of atoms (SearchBar, ModalDialog)  
- **Organisms**: Complex sections (DashboardWidget, TicketList)  

**Organization & Reuse**
- Each component has its own folder:  
  `/components/ui/Button/Button.tsx`,  
  `/components/ui/Button/Button.test.tsx`,  
  `/components/ui/Button/Button.module.css` (if needed).  
- Props are strongly typed in TypeScript, guaranteeing consistent use.  
- Shared logic (hooks, utilities) lives in `/hooks` or `/lib`.

**Maintainability Benefit**
- Changes in one atom automatically propagate to all uses.  
- Easy to find and update a specific component.  

---

## 5. State Management

**Local State**: Handled with React’s `useState` and `useReducer` inside components for simple form inputs or toggles.  

**Global State**:
- **Auth & Session**: Managed with React Context in `/providers/AuthProvider.tsx`.  
- **Complex UI State** (maps, filters): We recommend **Zustand** for its minimal boilerplate and good TypeScript support.  

**Data Fetching & Caching**
- Next.js’s server components fetch data directly from our internal API routes.  
- Client components use `react-query` (TanStack Query) to cache and sync data, ensuring a smooth user experience.

---

## 6. Routing and Navigation

**Routing Library**: Next.js App Router (file-based routing in `/app`).  

**Layouts**:
- Shared layouts (`/app/layout.tsx`) define common header, footer, and sidebar.  
- Nested layouts allow per-section customization (e.g., dashboard vs. master-data pages).  

**Navigation**:
- Sidebar component (`AppSidebar`) lists all major modules (Dashboard, Master Data, Tickets, Reports).  
- Links use Next’s `<Link>` component for client-side transitions.  
- Dynamic routes (e.g., `/tickets/[id]/page.tsx`) handle detail views automatically.

---

## 7. Performance Optimization

1. **Server-Side Rendering (SSR)** & **Static Generation**: Leverage Next.js for fast first-paint.  
2. **Code Splitting**: Dynamic `import()` for heavy libraries (react-leaflet, PDF generation).  
3. **Lazy Loading**: Widgets or charts load only when they appear in the viewport (`react-intersection-observer`).  
4. **Asset Optimization**: Next.js’s Image component, built-in compression, and caching headers.  
5. **PWA & Service Worker**: Offline caching of critical assets and forms, improving reliability in areas with poor connectivity.  

These steps keep our pages snappy, even as features grow.

---

## 8. Testing and Quality Assurance

**Unit Tests**:
- **Jest** + **React Testing Library** for components and hooks.  
- Mock API calls and Drizzle ORM interactions for predictable results.

**Integration Tests**:
- Combine multiple components and simulate real user flows (e.g., logging in, creating a ticket).  

**End-to-End Tests**:
- **Playwright** (or **Cypress**) to script scenarios like ticket submission, map interactions, and PDF generation.  

**Linting & Formatting**:
- **ESLint** with TypeScript rules.  
- **Prettier** for consistent code style.  

**CI/CD**:
- GitHub Actions runs lint, tests, and a build on every PR.  
- On merge to `main`, the latest build deploys automatically (e.g., to Vercel or Docker).  

---

## 9. Conclusion and Overall Frontend Summary

We’ve built a modern, maintainable, and high-performance frontend for Nexus CMMS using Next.js, TypeScript, shadcn/ui, and Tailwind CSS. Our component-driven approach, combined with strong design principles (usability, accessibility, responsiveness), ensures a consistent user experience.  

Key differentiators:
- **Type-Safe** integration with Drizzle ORM and PostgreSQL.  
- **Interactive Maps** powered by React-Leaflet for spatial insights.  
- **PWA Support** for offline data entry in the field.  
- **Robust Testing** and CI/CD for reliable releases.  

This guideline should serve as the single source of truth for frontend decisions, keeping the Nexus CMMS interface clear, fast, and future-proof.  

Let’s build something great!