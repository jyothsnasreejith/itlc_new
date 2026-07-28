# Project Architecture & Coding Standards

## 1. Frontend Clean Architecture
- **Centralized Service Layer**: Never invoke raw API fetches or database client calls directly inside UI view components or page files (`.jsx` / `.tsx`). All API calls must be centralized inside domain-specific service files in `src/services/` (e.g., `memberService.js`, `eventService.js`).
- **Custom Hooks & State Layer**: Wrap all service interactions and UI data fetching inside reusable custom hooks or React Context in `src/hooks/` (e.g., `useMembers.js`, `useEvents.js`). Custom hooks manage `loading`, `error`, and data caching states.
- **Clean UI Components**: Keep page components and UI views purely presentational. Components focus solely on JSX rendering, layout, styling, and user interaction triggers.

## 2. Backend Clean Architecture
- **Layered Architecture**: Enforce strict separation of concerns across 4 distinct layers:
  1. **Routes & Controllers** (`src/routes/`, `src/controllers/`): Handle HTTP requests (`req`), parameter validation, response status formatting (`res`), and delegate to services.
  2. **Services** (`src/services/`): Execute core business logic rules and workflows (e.g., PIN resets, mailers, validation).
  3. **Repositories** (`src/repositories/`): Single source of truth for all database queries and raw SQL statements.
  4. **Config & Middleware** (`src/config/`, `src/middlewares/`): DB pools (`db.js`), file upload handlers, and global error handling middleware.
- **Clean Entry Point**: Keep `server.js` lightweight (~50 lines), serving strictly to mount routes, initialize CORS/body-parsers, and register global error middlewares.
