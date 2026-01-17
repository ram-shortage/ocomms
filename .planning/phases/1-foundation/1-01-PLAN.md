---
phase: 1-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - next.config.ts
  - tailwind.config.ts
  - drizzle.config.ts
  - .env.local
  - .env.example
  - src/db/index.ts
  - src/db/schema/index.ts
  - src/db/schema/auth.ts
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/lib/utils.ts
  - components.json
autonomous: true
user_setup:
  - service: postgresql
    why: "Database for all application data"
    env_vars:
      - name: DATABASE_URL
        source: "Local PostgreSQL instance or Docker container"
    dashboard_config:
      - task: "Create database named 'ocomms'"
        location: "psql or pgAdmin"
  - service: smtp
    why: "Email verification and invitations"
    env_vars:
      - name: SMTP_HOST
        source: "Email provider settings"
      - name: SMTP_PORT
        source: "Email provider settings (typically 587)"
      - name: SMTP_USER
        source: "Email provider credentials"
      - name: SMTP_PASS
        source: "Email provider credentials"
      - name: EMAIL_FROM
        source: "Your sending email address"

must_haves:
  truths:
    - "Next.js app starts without errors"
    - "Database connection is established"
    - "Drizzle schema can be pushed to database"
    - "shadcn/ui components render correctly"
  artifacts:
    - path: "package.json"
      provides: "Project dependencies"
      contains: "better-auth"
    - path: "src/db/index.ts"
      provides: "Database connection"
      exports: ["db"]
    - path: "src/db/schema/auth.ts"
      provides: "better-auth schema tables"
      contains: "pgTable"
    - path: "drizzle.config.ts"
      provides: "Drizzle configuration"
      contains: "defineConfig"
  key_links:
    - from: "src/db/index.ts"
      to: "DATABASE_URL"
      via: "environment variable"
      pattern: "process\\.env\\.DATABASE_URL"
    - from: "src/db/schema/index.ts"
      to: "src/db/schema/auth.ts"
      via: "re-export"
      pattern: "export.*from.*auth"
---

<objective>
Set up Next.js 15 project with Drizzle ORM, PostgreSQL connection, and better-auth schema.

Purpose: Establish the foundation that all subsequent plans build upon - database, ORM, and UI framework.
Output: Working Next.js application with database connectivity and auth schema ready.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/1-foundation/1-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Next.js Project Initialization</name>
  <files>
    package.json, tsconfig.json, next.config.ts, tailwind.config.ts,
    src/app/layout.tsx, src/app/page.tsx, src/lib/utils.ts, components.json,
    .env.local, .env.example
  </files>
  <action>
    Create Next.js 15 project with the following:

    1. Initialize with: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack`
       (Use --no-turbopack for stability; turbopack can be enabled later)

    2. Install core dependencies:
       ```bash
       npm install better-auth drizzle-orm postgres dotenv
       npm install -D drizzle-kit @better-auth/cli tsx @types/node
       ```

    3. Install UI dependencies:
       ```bash
       npm install @radix-ui/react-icons lucide-react class-variance-authority clsx tailwind-merge
       ```

    4. Initialize shadcn/ui:
       ```bash
       npx shadcn@latest init -d
       ```
       Select: New York style, Zinc base color, CSS variables

    5. Create .env.example with all required environment variables:
       ```
       DATABASE_URL=postgresql://user:password@localhost:5432/ocomms
       BETTER_AUTH_SECRET=
       BETTER_AUTH_URL=http://localhost:3000
       SMTP_HOST=
       SMTP_PORT=587
       SMTP_USER=
       SMTP_PASS=
       EMAIL_FROM=
       NEXT_PUBLIC_APP_URL=http://localhost:3000
       ```

    6. Create .env.local copying .env.example (user fills in values)

    7. Update src/lib/utils.ts with cn() helper if not present:
       ```typescript
       import { type ClassValue, clsx } from "clsx"
       import { twMerge } from "tailwind-merge"

       export function cn(...inputs: ClassValue[]) {
         return twMerge(clsx(inputs))
       }
       ```
  </action>
  <verify>
    - `npm run dev` starts without errors
    - Navigate to http://localhost:3000 shows Next.js page
    - `.env.example` contains all 9 environment variables
  </verify>
  <done>
    Next.js 15 app runs locally with Tailwind CSS and shadcn/ui configured.
    All dependencies installed. Environment template ready.
  </done>
</task>

<task type="auto">
  <name>Task 2: Database and Drizzle Setup</name>
  <files>
    drizzle.config.ts, src/db/index.ts, src/db/schema/index.ts, src/db/schema/auth.ts
  </files>
  <action>
    Set up Drizzle ORM with PostgreSQL and generate better-auth schema:

    1. Create drizzle.config.ts:
       ```typescript
       import { defineConfig } from "drizzle-kit";
       import "dotenv/config";

       export default defineConfig({
         schema: "./src/db/schema/index.ts",
         out: "./src/db/migrations",
         dialect: "postgresql",
         dbCredentials: {
           url: process.env.DATABASE_URL!,
         },
         casing: "snake_case",
       });
       ```

    2. Create src/db/index.ts:
       ```typescript
       import { drizzle } from "drizzle-orm/postgres-js";
       import postgres from "postgres";
       import * as schema from "./schema";

       const connectionString = process.env.DATABASE_URL!;
       const client = postgres(connectionString);

       export const db = drizzle(client, {
         schema,
         casing: "snake_case",
       });
       ```

    3. Generate better-auth schema for Drizzle:
       ```bash
       npx @better-auth/cli generate --config ./src/lib/auth.ts --output ./src/db/schema/auth.ts
       ```
       Note: This requires a minimal auth.ts file first. Create a temporary one:
       ```typescript
       // src/lib/auth.ts (temporary for schema generation)
       import { betterAuth } from "better-auth";
       import { organization } from "better-auth/plugins";

       export const auth = betterAuth({
         database: { type: "postgres" },
         emailAndPassword: { enabled: true },
         plugins: [organization()],
       });
       ```

    4. If CLI generation fails, manually create src/db/schema/auth.ts with better-auth tables:
       - users, sessions, accounts, verifications (core tables)
       - organizations, members, invitations (organization plugin tables)
       Use uuid() for id columns with defaultRandom()

    5. Create src/db/schema/index.ts re-exporting all schema:
       ```typescript
       export * from "./auth";
       ```

    6. Add scripts to package.json:
       ```json
       "db:generate": "drizzle-kit generate",
       "db:migrate": "drizzle-kit migrate",
       "db:push": "drizzle-kit push",
       "db:studio": "drizzle-kit studio"
       ```

    7. Push schema to database (requires DATABASE_URL set):
       ```bash
       npm run db:push
       ```
  </action>
  <verify>
    - `npm run db:push` completes without errors
    - `npm run db:studio` opens Drizzle Studio showing tables:
      users, sessions, accounts, verifications, organizations, members, invitations
    - src/db/schema/auth.ts exports table definitions
  </verify>
  <done>
    Database schema pushed to PostgreSQL. Drizzle Studio shows all better-auth tables.
    Schema files ready for auth configuration.
  </done>
</task>

</tasks>

<verification>
Run these commands to verify plan completion:

```bash
# App starts
npm run dev &
sleep 5
curl -s http://localhost:3000 | grep -q "Next" && echo "App running"

# Database connected
npm run db:push

# Schema exists
ls src/db/schema/auth.ts
```
</verification>

<success_criteria>
- Next.js 15 development server starts without errors
- PostgreSQL database has better-auth tables created
- Drizzle Studio shows: users, sessions, accounts, verifications, organizations, members, invitations
- shadcn/ui initialized and cn() utility available
- Environment variables template (.env.example) complete
</success_criteria>

<output>
After completion, create `.planning/phases/1-foundation/1-01-SUMMARY.md`
</output>
