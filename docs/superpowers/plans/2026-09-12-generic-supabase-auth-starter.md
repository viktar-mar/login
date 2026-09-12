# Generic Supabase Auth Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, production-conscious Next.js starter for Supabase email/password and configurable social authentication.

**Architecture:** A Next.js App Router application owns its UI and delegates authentication to a small `@supabase/ssr` adapter. Server actions implement auth mutations, route handlers complete OAuth and email-token exchanges, protected server components verify claims again, and PostgreSQL RLS remains the final data boundary.

**Tech Stack:** Node.js 24, npm, Next.js 16+, React 19+, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL, Zod, next-themes, Vitest, Testing Library, pgTAP, Playwright, and GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-generic-supabase-auth-starter-design.md`

## Global Constraints

- Use Node.js 24 with npm; commit `package-lock.json` and pin the installed stable dependency versions there.
- Support Google, Facebook, Apple, GitHub, Microsoft (`azure`), and Discord; each provider and email/password must be independently configurable.
- Keep routes unprefixed by locale; resolve `en` or `ru` from a locale cookie, then `Accept-Language`, then the configured default.
- Default minimum password length is 8 and must match the Supabase project setting documented in the setup guide.
- Use only the Supabase project URL and publishable key in the application. Never add a secret key, legacy `service_role` key, provider secret, password, token, or authorization code to source control or browser output.
- Use `supabase.auth.getClaims()` in protected server layouts and data access; request-proxy redirects are not the sole authorization boundary.
- Enable RLS on `public.profiles`; authenticated users may select and update only the row where `id = auth.uid()`.
- Validate every form again on the server and accept redirect targets only through the shared safe-local-path validator.
- Do not add roles, organizations, invitations, magic links, OTP login, phone login, passkeys, MFA, SSO, provider-token storage, or an admin UI.
- Add behavior test-first, observe the expected failure, implement the smallest passing behavior, and run the focused test before the task-level verification.

## Planned File Structure

```text
.
├── .env.example                         # safe public configuration names
├── .github/workflows/ci.yml             # secret-free quality gates
├── .gitignore
├── .nvmrc                               # Node 24
├── README.md                            # adopter and provider setup
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── playwright.config.ts
├── postcss.config.mjs
├── prettier.config.mjs
├── .prettierignore
├── tsconfig.json
├── vitest.config.mts
├── vitest.setup.ts
├── e2e/auth.spec.ts
├── public/logo.svg
├── src/
│   ├── proxy.ts                         # Next.js request proxy entrypoint
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── update-password/page.tsx
│   │   ├── (protected)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── auth/
│   │       ├── callback/route.ts
│   │       └── confirm/route.ts
│   ├── components/
│   │   ├── auth-shell.tsx
│   │   ├── locale-switcher.tsx
│   │   ├── theme-provider.tsx
│   │   ├── theme-switcher.tsx
│   │   └── ui/{alert,button,card,input,label,spinner}.tsx
│   ├── config/
│   │   ├── auth.ts
│   │   ├── env-schema.ts
│   │   ├── env.ts
│   │   └── site.ts
│   ├── features/
│   │   ├── auth/
│   │   │   ├── actions.ts
│   │   │   ├── error-map.ts
│   │   │   ├── schemas.ts
│   │   │   ├── types.ts
│   │   │   ├── server/service.ts
│   │   │   └── components/{auth-message,email-form,oauth-buttons,password-field,submit-button}.tsx
│   │   └── profile/
│   │       ├── actions.ts
│   │       ├── schema.ts
│   │       ├── server/queries.ts
│   │       └── components/profile-form.tsx
│   ├── i18n/
│   │   ├── actions.ts
│   │   ├── dictionaries/{en,ru}.ts
│   │   ├── provider.tsx
│   │   ├── server.ts
│   │   └── types.ts
│   └── lib/
│       ├── auth/{require-user,verified-identity}.ts
│       ├── navigation/safe-next.ts
│       ├── supabase/{client,proxy,server}.ts
│       └── utils/cn.ts
└── supabase/
    ├── config.toml
    ├── migrations/202609120001_create_profiles.sql
    ├── templates/{confirmation,recovery}.html
    └── tests/profiles_rls.test.sql
```

Tests live next to TypeScript source as `*.test.ts` or `*.test.tsx` unless a separate path is named above.

## Task 1: Application Foundation and Quality Commands

**Files:**

- Create: `.nvmrc`, `.gitignore`, `package.json`, `package-lock.json`
- Create: `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `prettier.config.mjs`, `.prettierignore`
- Create: `vitest.config.mts`, `vitest.setup.ts`
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.test.tsx`
- Create: `public/logo.svg`

**Responsibilities:** Establish a runnable Next.js/Tailwind application, deterministic npm dependency graph, and lint/type/unit/build commands.

- [ ] **Step 1: Create the npm manifest and tool configuration**

Use this script surface in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset --local",
    "test:db": "supabase test db",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test:run && npm run build"
  },
  "engines": { "node": ">=24" }
}
```

Install runtime packages with:

```bash
npm install next@latest react@latest react-dom@latest @supabase/ssr@latest @supabase/supabase-js@latest zod@latest next-themes@latest clsx@latest tailwind-merge@latest react-icons@latest
```

Install development packages with:

```bash
npm install --save-dev typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest tailwindcss@latest @tailwindcss/postcss@latest postcss@latest eslint@latest eslint-config-next@latest prettier@latest prettier-plugin-tailwindcss@latest vitest@latest jsdom@latest @vitejs/plugin-react@latest vite-tsconfig-paths@latest @testing-library/react@latest @testing-library/jest-dom@latest @testing-library/user-event@latest @playwright/test@latest supabase@latest
```

Set `.nvmrc` to `24`. Configure TypeScript strict mode and alias `@/* -> ./src/*`. Configure Vitest for jsdom, React, the alias, `vitest.setup.ts`, restored mocks, and CSS support. Configure Tailwind 4 through `@tailwindcss/postcss` and `@import "tailwindcss"`.

- [ ] **Step 2: Write the failing root-page test**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("offers entry to the authentication flow", () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
    "href",
    "/login",
  );
});
```

- [ ] **Step 3: Run the test and confirm the missing page/config failure**

Run: `npm run test:run -- src/app/page.test.tsx`

Expected: FAIL because `src/app/page.tsx` or its tested sign-in link does not exist.

- [ ] **Step 4: Implement the minimal app shell and root page**

Create metadata, root `<html>`/`<body>`, import `globals.css`, render the local logo, product placeholder, and a `/login` link named `Sign in`. Use a simple accessible layout; theme and translations are added in later tasks.

- [ ] **Step 5: Run foundation verification**

Run:

```bash
npm run test:run -- src/app/page.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the foundation**

```bash
git add .nvmrc .gitignore .prettierignore package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs postcss.config.mjs prettier.config.mjs vitest.config.mts vitest.setup.ts public src/app
git commit -m "chore: scaffold Next.js auth starter"
```

## Task 2: Typed Public Configuration and Safe Redirects

**Files:**

- Create: `.env.example`
- Create: `src/config/env-schema.ts`, `src/config/env-schema.test.ts`
- Create: `src/config/env.ts`, `src/config/auth.ts`, `src/config/site.ts`
- Create: `src/lib/navigation/safe-next.ts`, `src/lib/navigation/safe-next.test.ts`

**Interfaces:**

- `parsePublicEnv(input: PublicEnvInput): PublicEnv`
- `AuthProvider = "google" | "facebook" | "apple" | "github" | "azure" | "discord"`
- `authConfig: { emailEnabled: boolean; providers: readonly AuthProvider[]; passwordMinLength: 8 }`
- `siteConfig: { name; description; logo; defaultLocale; locales; afterLoginPath }`
- `safeNextPath(value: string | null | undefined, fallback: string): string`

- [ ] **Step 1: Write failing configuration and redirect tests**

Cover these exact cases:

```ts
expect(parsePublicEnv(validInput).authProviders).toEqual(["google", "github"]);
expect(() => parsePublicEnv({ ...validInput, authProviders: "google,unknown" })).toThrow(/unknown/i);
expect(() => parsePublicEnv({ ...validInput, authProviders: "", emailAuth: "false" })).toThrow(/method/i);
expect(safeNextPath("/profile?tab=account", "/dashboard")).toBe("/profile?tab=account");
expect(safeNextPath("https://evil.example", "/dashboard")).toBe("/dashboard");
expect(safeNextPath("//evil.example", "/dashboard")).toBe("/dashboard");
expect(safeNextPath("/\\evil.example", "/dashboard")).toBe("/dashboard");
```

- [ ] **Step 2: Run the focused tests and confirm missing-module failures**

Run: `npm run test:run -- src/config/env-schema.test.ts src/lib/navigation/safe-next.test.ts`

Expected: FAIL because the parser and redirect validator do not exist.

- [ ] **Step 3: Implement schemas and static configuration**

Use Zod to validate:

```ts
const providerSchema = z.enum([
  "google",
  "facebook",
  "apple",
  "github",
  "azure",
  "discord",
]);
```

`src/config/env.ts` must pass direct property reads so Next.js can inline public values:

```ts
export const publicEnv = parsePublicEnv({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  authProviders: process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
  emailAuth: process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH,
});
```

Reject control characters, backslashes, protocol-relative paths, absolute URLs, and non-leading-slash paths in `safeNextPath`.

- [ ] **Step 4: Add the safe environment template**

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=copy-the-publishable-key-from-supabase-status
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_PROVIDERS=google,facebook,apple,github,azure,discord
NEXT_PUBLIC_ENABLE_EMAIL_AUTH=true
```

- [ ] **Step 5: Run task verification**

Run: `npm run test:run -- src/config src/lib/navigation && npm run typecheck`

Expected: all tests and type checking pass.

- [ ] **Step 6: Commit configuration**

```bash
git add .env.example src/config src/lib/navigation
git commit -m "feat: add typed auth configuration"
```

## Task 3: Pathless English/Russian Localization

**Files:**

- Create: `src/i18n/types.ts`
- Create: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/ru.ts`
- Create: `src/i18n/server.ts`, `src/i18n/server.test.ts`
- Create: `src/i18n/provider.tsx`, `src/i18n/provider.test.tsx`
- Create: `src/i18n/actions.ts`
- Create: `src/components/locale-switcher.tsx`, `src/components/locale-switcher.test.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.test.tsx`

**Interfaces:**

- `Locale = "en" | "ru"`
- `Dictionary` is inferred from the English dictionary; the Russian dictionary must satisfy the same shape.
- `chooseLocale(cookieValue, acceptLanguage, supported, fallback): Locale`
- `getRequestLocale(): Promise<Locale>`
- `getDictionary(locale): Dictionary`
- `setLocaleAction(locale: Locale): Promise<void>` sets `auth-starter-locale` with `sameSite: "lax"`, one-year max age, and `/` path.
- `useDictionary(): { locale: Locale; dictionary: Dictionary }`

- [ ] **Step 1: Write failing locale precedence tests**

```ts
expect(chooseLocale("ru", "en-US,en;q=0.9", ["en", "ru"], "en")).toBe("ru");
expect(chooseLocale("xx", "ru-RU,ru;q=0.9", ["en", "ru"], "en")).toBe("ru");
expect(chooseLocale(undefined, "de-DE", ["en", "ru"], "en")).toBe("en");
```

Add a provider test proving `useDictionary()` returns Russian `auth.signIn`, plus a switcher test proving that selecting English calls `setLocaleAction("en")` and refreshes the current route.

- [ ] **Step 2: Run locale tests and confirm failures**

Run: `npm run test:run -- src/i18n src/components/locale-switcher.test.tsx`

Expected: FAIL because locale resolution, provider, and switcher are absent.

- [ ] **Step 3: Implement typed dictionaries and locale resolution**

Include every string category needed by later tasks: navigation, login, signup, email confirmation, password recovery/update, OAuth provider labels, dashboard, profile, validation, generic errors, theme, and locale names. Parse weighted `Accept-Language` values and match both exact tags and the primary subtag.

- [ ] **Step 4: Implement provider, server action, and switcher**

The root layout resolves locale on the server and passes only the selected dictionary into the client provider. The switcher calls the server action inside a transition, then `router.refresh()`; no locale is added to the URL.

- [ ] **Step 5: Localize the root page and run verification**

Run: `npm run test:run -- src/i18n src/components/locale-switcher.test.tsx src/app/page.test.tsx && npm run typecheck`

Expected: all commands exit 0 and the English fallback root link remains `/login`.

- [ ] **Step 6: Commit localization**

```bash
git add src/i18n src/components/locale-switcher.tsx src/components/locale-switcher.test.tsx src/app/layout.tsx src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: add English and Russian localization"
```

## Task 4: Theme, Accessible UI Primitives, and Auth Shell

**Files:**

- Create: `src/lib/utils/cn.ts`, `src/lib/utils/cn.test.ts`
- Create: `src/components/theme-provider.tsx`, `src/components/theme-switcher.tsx`, `src/components/theme-switcher.test.tsx`
- Create: `src/components/ui/alert.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `spinner.tsx`
- Create: `src/components/auth-shell.tsx`, `src/components/auth-shell.test.tsx`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

**Interfaces:**

- `cn(...inputs: ClassValue[]): string`
- `ThemeProvider` wraps `next-themes` with attribute `class`, default `system`, and system theme enabled.
- `AuthShell({ title, description, children, footer })`

- [ ] **Step 1: Write failing UI behavior tests**

Test that `cn("p-2", false && "hidden", "p-4")` yields the Tailwind-merged `p-4`. Test that `AuthShell` exposes its title as a heading and renders the logo alt text from `siteConfig.name`. Test that the theme switcher has an accessible localized label and calls `setTheme`.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `npm run test:run -- src/lib/utils src/components/auth-shell.test.tsx src/components/theme-switcher.test.tsx`

Expected: FAIL because the utilities and components do not exist.

- [ ] **Step 3: Implement local UI primitives and theme**

Build small `forwardRef` primitives that preserve native props. Use CSS variables in `globals.css` for background, foreground, card, border, primary, destructive, muted, ring, and radius in light and dark modes. Add visible `:focus-visible` treatment and a reduced-motion rule. Do not add a component runtime beyond packages already installed.

- [ ] **Step 4: Compose the application shell**

Wrap the app with `ThemeProvider` and `I18nProvider`, set `<html lang={locale} suppressHydrationWarning>`, and place theme/locale controls in a shared header. Ensure the auth shell is usable at 320 px width and keeps labels visible.

- [ ] **Step 5: Run task verification**

Run: `npm run test:run -- src/lib/utils src/components && npm run lint && npm run typecheck`

Expected: all commands exit 0.

- [ ] **Step 6: Commit UI foundation**

```bash
git add src/lib/utils src/components src/app/globals.css src/app/layout.tsx
git commit -m "feat: add themeable accessible UI shell"
```

## Task 5: Supabase SSR Adapter and Request Proxy

**Files:**

- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`, `src/lib/supabase/proxy.test.ts`
- Create: `src/lib/auth/verified-identity.ts`, `src/lib/auth/verified-identity.test.ts`
- Create: `src/proxy.ts`

**Interfaces:**

- `createBrowserSupabaseClient(): SupabaseClient`
- `createServerSupabaseClient(): Promise<SupabaseClient>`
- `getVerifiedIdentity(supabase?): Promise<{ userId: string; email?: string } | null>`
- `classifyAuthRoute(pathname): "protected" | "anonymous-only" | "public"`
- `updateSupabaseSession(request: NextRequest): Promise<NextResponse>`

- [ ] **Step 1: Write failing route-classification tests**

```ts
expect(classifyAuthRoute("/dashboard")).toBe("protected");
expect(classifyAuthRoute("/profile/settings")).toBe("protected");
expect(classifyAuthRoute("/login")).toBe("anonymous-only");
expect(classifyAuthRoute("/auth/callback")).toBe("public");
```

Also inject a fake claims result into the proxy decision helper and assert: anonymous protected requests go to `/login?next=%2Fdashboard`; authenticated login requests go to `/dashboard`; public requests do not redirect. Test that `getVerifiedIdentity` returns a typed `sub`/email pair from `getClaims()`, returns `null` on an invalid claim, and never calls `getSession()`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm run test:run -- src/lib/supabase/proxy.test.ts`

Expected: FAIL because the adapter and route rules are missing.

- [ ] **Step 3: Implement browser and server clients**

Use `createBrowserClient` for client code. Use `createServerClient` plus `await cookies()` on the server, forwarding `getAll()` and best-effort `setAll()` exactly through the adapter. Read only `publicEnv.supabaseUrl` and `publicEnv.supabasePublishableKey`. Implement `getVerifiedIdentity` as the shared non-redirecting `getClaims()` reader for auth and protected pages.

- [ ] **Step 4: Implement cookie refresh and redirect decisions**

The proxy must call `getClaims()`, preserve every cookie written by Supabase on both pass-through and redirect responses, and send only a safe local `next` path. The root entrypoint delegates directly:

```ts
export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 5: Run adapter verification**

Run: `npm run test:run -- src/lib/supabase src/lib/auth/verified-identity.test.ts && npm run typecheck`

Expected: tests pass and server-only modules are never imported into client components.

- [ ] **Step 6: Commit the adapter**

```bash
git add src/lib/supabase src/lib/auth/verified-identity.ts src/lib/auth/verified-identity.test.ts src/proxy.ts
git commit -m "feat: add Supabase SSR session adapter"
```

## Task 6: Profiles Migration, Trigger, Grants, and RLS Tests

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/migrations/202609120001_create_profiles.sql`
- Create: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`
- Create: `supabase/tests/profiles_rls.test.sql`

**Responsibilities:** Reproduce the database locally/remotely, create profiles safely, and prove owner-only access at the database boundary.

- [ ] **Step 1: Initialize local Supabase configuration**

Run: `npx supabase init`

Set the generated config to these values, leaving unrelated generated defaults intact:

```toml
project_id = "generic-supabase-auth-starter"

[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/auth/confirm",
  "http://localhost:3000/update-password",
]
minimum_password_length = 8

[auth.email]
enable_signup = true
enable_confirmations = true

[auth.email.template.confirmation]
subject = "Confirm your email"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Reset your password"
content_path = "./supabase/templates/recovery.html"

[inbucket]
enabled = true
port = 54324
```

Do not enable or commit social-provider secrets in local config.

- [ ] **Step 2: Write the failing pgTAP test**

Create a transaction-scoped test that plans assertions for:

- the `public.profiles` table, primary key, foreign key, and RLS flag;
- the automatic profile row created for a test `auth.users` insert, including normalized/truncated metadata;
- anonymous users seeing zero profile rows;
- an authenticated owner selecting and updating exactly their row;
- another authenticated user being unable to select or update that row;
- authenticated and anonymous direct inserts being rejected;
- client updates to `id`, `created_at`, or `updated_at` and client deletes being rejected;
- the database trigger changing `updated_at` after an allowed profile-field update.

Use fixed test UUIDs, `set local role authenticated`, and `set local request.jwt.claim.sub` so `auth.uid()` is evaluated under the intended identity. End with `select * from finish(); rollback;`.

- [ ] **Step 3: Start the stack and observe the expected database-test failure**

Run:

```bash
npm run supabase:start
npm run test:db
```

Expected: FAIL because `public.profiles` and its policies do not exist. If Docker is unavailable, record this verification as pending and continue only with SQL static review until Docker is available.

- [ ] **Step 4: Implement the migration**

The migration must:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
```

Add a `security definer set search_path = ''` `public.handle_new_user()` trigger function that inserts a trimmed/truncated display name and an avatar URL from `raw_user_meta_data`, tolerates missing values, and fully qualifies objects. Add an `updated_at` trigger. Create separate `select` and `update` policies `to authenticated`, both using `(select auth.uid()) = id`, with an update `with check` clause using the same expression.

- [ ] **Step 5: Add SSR-compatible local email templates**

Keep the HTML minimal and put the action links on the application origin passed as `RedirectTo`:

```html
<!-- confirmation.html -->
<h2>Confirm your email</h2>
<p>
  <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    Confirm email
  </a>
</p>
```

```html
<!-- recovery.html -->
<h2>Reset your password</h2>
<p>
  <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
    Reset password
  </a>
</p>
```

- [ ] **Step 6: Reset and verify the database**

Run:

```bash
npm run supabase:reset
npm run test:db
```

Expected: all pgTAP assertions pass.

- [ ] **Step 7: Commit the database contract**

```bash
git add supabase package.json package-lock.json
git commit -m "feat: add protected user profiles schema"
```

## Task 7: Auth Validation, Error Model, and Server Services

**Files:**

- Create: `src/features/auth/types.ts`
- Create: `src/features/auth/schemas.ts`, `src/features/auth/schemas.test.ts`
- Create: `src/features/auth/error-map.ts`, `src/features/auth/error-map.test.ts`
- Create: `src/features/auth/server/service.ts`, `src/features/auth/server/service.test.ts`
- Create: `src/features/auth/actions.ts`, `src/features/auth/actions.test.ts`

**Interfaces:**

- `AuthErrorCode = "invalid_credentials" | "email_not_confirmed" | "weak_password" | "rate_limited" | "invalid_link" | "provider_unavailable" | "unexpected"`
- `AuthActionState = { status: "idle" } | { status: "success"; code: "check_email" | "recovery_sent" } | { status: "error"; code: AuthErrorCode; fieldErrors?: Record<string, string[]> }`
- Zod schemas: `loginSchema`, `signupSchema`, `forgotPasswordSchema`, `updatePasswordSchema`, `providerSchema`
- Service methods accept a Supabase client and typed input, returning a discriminated result without redirecting.
- Server actions validate `FormData`, call services, map errors, and redirect only after success.

- [ ] **Step 1: Write failing validation and safe-error tests**

Assert invalid email rejection, password length 7 rejection, mismatched signup/update confirmation rejection, disabled provider rejection, stable mapping from Supabase error codes, and fallback to `unexpected` without returning an original error message.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm run test:run -- src/features/auth/schemas.test.ts src/features/auth/error-map.test.ts`

Expected: FAIL because the schemas and mapping do not exist.

- [ ] **Step 3: Implement types, schemas, and error mapping**

Prefer documented Supabase error `code` values. Never branch on or display a raw backend message except in a sanitized server log. Keep `AuthActionState` serializable for React `useActionState`.

- [ ] **Step 4: Write failing service/action tests with an injected Supabase double**

Cover calls to `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`, `signOut`, and `signInWithOAuth`. Prove that signup/recovery use the configured site origin, successful login uses `safeNextPath`, reset returns the same `recovery_sent` response whether Supabase reveals a user or not, and OAuth rejects a provider not enabled in `authConfig`.

- [ ] **Step 5: Implement services and thin server actions**

Use `"use server"` only in `actions.ts`. Keep API interaction in `server/service.ts`. Build email redirect origins from the validated `publicEnv.siteUrl`; do not trust request headers. Use the shared error model for every expected failure.

- [ ] **Step 6: Run task verification**

Run: `npm run test:run -- src/features/auth && npm run typecheck`

Expected: all tests pass.

- [ ] **Step 7: Commit auth domain logic**

```bash
git add src/features/auth
git commit -m "feat: add validated Supabase auth actions"
```

## Task 8: Email/Password Pages and Form Components

**Files:**

- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/update-password/page.tsx`
- Create: `src/features/auth/components/auth-message.tsx`
- Create: `src/features/auth/components/email-form.tsx`, `src/features/auth/components/email-form.test.tsx`
- Create: `src/features/auth/components/password-field.tsx`, `src/features/auth/components/password-field.test.tsx`
- Create: `src/features/auth/components/submit-button.tsx`

**Interfaces:**

- `EmailForm({ mode: "login" | "signup" | "forgot" | "update", next?: string })`
- `PasswordField` preserves native input props and supplies an accessible show/hide control.
- `AuthMessage({ state })` renders only dictionary text selected from the stable state code.

- [ ] **Step 1: Write failing form behavior tests**

Test all four modes. Assert correct labels and autocomplete values, signup/update confirmation, password visibility toggle, disabled submit while pending, localized field errors, neutral recovery success, login/signup cross-links, and preservation of a sanitized `next` value. Assert email forms are absent when `authConfig.emailEnabled` is false.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm run test:run -- src/features/auth/components`

Expected: FAIL because the forms do not exist.

- [ ] **Step 3: Implement form components with `useActionState`**

Associate every error through `aria-describedby`, announce page-level results using `role="status"` or `role="alert"`, retain non-secret email input after a recoverable failure, and never repopulate password fields. Use `useFormStatus` in the submit button.

- [ ] **Step 4: Compose the four auth pages**

Use `AuthShell`, resolve dictionary on the server, export useful metadata, and redirect already-authenticated login/signup visitors using `getVerifiedIdentity`. The update page must refuse rendering the form unless `getVerifiedIdentity` returns a valid current claim after the recovery link exchange.

- [ ] **Step 5: Run task verification**

Run: `npm run test:run -- src/features/auth/components src/app && npm run lint && npm run typecheck`

Expected: all tests and static checks pass.

- [ ] **Step 6: Commit email/password UI**

```bash
git add src/app src/features/auth/components
git commit -m "feat: add email authentication pages"
```

## Task 9: Configurable Social Login and Auth Route Handlers

**Files:**

- Create: `src/features/auth/components/oauth-buttons.tsx`, `src/features/auth/components/oauth-buttons.test.tsx`
- Create: `src/app/auth/callback/route.ts`, `src/app/auth/callback/route.test.ts`
- Create: `src/app/auth/confirm/route.ts`, `src/app/auth/confirm/route.test.ts`
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- Modify: `src/i18n/dictionaries/en.ts`, `src/i18n/dictionaries/ru.ts`

**Interfaces:**

- Provider registry preserves configured order and maps `azure` to the localized Microsoft label.
- `/auth/callback`: accepts one PKCE `code` plus optional safe `next`; exchanges the code, strips it from the destination, and redirects.
- `/auth/confirm`: accepts `token_hash` and only `email` or `recovery`; calls `verifyOtp`, strips auth parameters, and redirects to `/dashboard` or `/update-password` respectively.

- [ ] **Step 1: Write failing OAuth-button tests**

Given `providers: ["google", "azure", "discord"]`, assert exactly three buttons, in that order, with Google/Microsoft/Discord labels and hidden provider inputs. Assert an empty provider list renders no divider when email auth is enabled.

- [ ] **Step 2: Run the component test and confirm failure**

Run: `npm run test:run -- src/features/auth/components/oauth-buttons.test.tsx`

Expected: FAIL because the provider registry and buttons do not exist.

- [ ] **Step 3: Implement provider registry and social buttons**

Use local provider metadata and `react-icons` brand icons. Submit through the OAuth server action. Disable all buttons while one action is pending, but include the chosen provider in the form data.

- [ ] **Step 4: Write failing route-handler tests**

Mock `createServerSupabaseClient`. Prove OAuth success calls `exchangeCodeForSession` once and redirects to a safe path; missing/failed codes redirect to `/login?error=invalid_link`; absolute or protocol-relative `next` inputs fall back to `/dashboard`. Prove email confirmation allows only `email` and `recovery`, calls `verifyOtp({ token_hash, type })`, never includes the token hash in its redirect, and sends recovery sessions only to `/update-password`.

- [ ] **Step 5: Implement both route handlers**

Map external failures to stable error query values. Build redirect URLs from the validated `publicEnv.siteUrl` rather than a request `Host` header, replace the pathname, clear all original search parameters, and add only an allowlisted error code when needed.

- [ ] **Step 6: Add social buttons to login and signup and verify**

Run: `npm run test:run -- src/features/auth/components/oauth-buttons.test.tsx src/app/auth && npm run typecheck`

Expected: all tests pass.

- [ ] **Step 7: Commit social and callback flows**

```bash
git add src/features/auth/components/oauth-buttons.tsx src/features/auth/components/oauth-buttons.test.tsx src/app/auth src/app/'(auth)' src/i18n/dictionaries
git commit -m "feat: add configurable social authentication"
```

## Task 10: Protected Dashboard, Profile, and Logout

**Files:**

- Create: `src/lib/auth/require-user.ts`, `src/lib/auth/require-user.test.ts`
- Create: `src/app/(protected)/layout.tsx`
- Create: `src/app/(protected)/dashboard/page.tsx`
- Create: `src/app/(protected)/profile/page.tsx`
- Create: `src/features/profile/schema.ts`, `src/features/profile/schema.test.ts`
- Create: `src/features/profile/server/queries.ts`, `src/features/profile/server/queries.test.ts`
- Create: `src/features/profile/actions.ts`, `src/features/profile/actions.test.ts`
- Create: `src/features/profile/components/profile-form.tsx`, `src/features/profile/components/profile-form.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**

- `requireUser(nextPath?: string): Promise<{ supabase; userId: string; email?: string }>` wraps `getVerifiedIdentity`, reuses the server client, and redirects anonymous callers to `/login` with a safe continuation.
- `getOwnProfile(supabase, userId): Promise<Profile | null>` always filters by the verified claim ID.
- `updateProfileAction(previousState, formData): Promise<ProfileActionState>` derives user ID from claims, never from form data.

- [ ] **Step 1: Write failing guard and profile-schema tests**

Assert missing/invalid claims redirect to login, valid claims return `sub`, no `getSession()` call is made, names over 100 characters fail, whitespace-only names fail, and avatar URLs allow only `http:` or `https:` when present.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm run test:run -- src/lib/auth src/features/profile/schema.test.ts`

Expected: FAIL because the guard and schema do not exist.

- [ ] **Step 3: Implement the secure guard and profile data functions**

Call `getClaims()` on the server client and read `claims.sub` only after type checking it as a non-empty string. Query `.from("profiles").select("id, display_name, avatar_url, created_at, updated_at").eq("id", userId).maybeSingle()`. Treat RLS as mandatory even though the query includes the ID.

- [ ] **Step 4: Write failing action and component tests**

Prove updates use the claim ID instead of submitted identity fields, validation errors are localized, the current profile values render, and logout invokes the existing auth action. Prove the protected layout does not render children after an anonymous redirect.

- [ ] **Step 5: Implement protected pages and profile form**

The dashboard displays the verified email/ID and links to profile. The profile form edits display name and avatar URL. Navigation exposes dashboard, profile, theme, locale, and logout. Avoid exposing access tokens or raw claims.

- [ ] **Step 6: Run task verification**

Run: `npm run test:run -- src/lib/auth src/features/profile src/app/'(protected)' && npm run lint && npm run typecheck`

Expected: all commands exit 0.

- [ ] **Step 7: Commit protected account UI**

```bash
git add src/lib/auth src/features/profile src/app/'(protected)' src/app/page.tsx
git commit -m "feat: add protected dashboard and profile"
```

## Task 11: Browser Smoke Tests and Local Supabase Workflow

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `supabase/config.toml`
- Modify: `package.json`, `package-lock.json`

**Responsibilities:** Prove the user-visible local email flow and protected redirects; keep external social accounts out of automated CI.

- [ ] **Step 1: Configure Playwright against the local app**

Use Chromium by default, retain trace on first retry, and start `npm run dev` on port 3000 with local Supabase public values supplied as environment variables. Fail fast with a clear message when the local Supabase stack is not reachable. Do not commit generated reports, traces, screenshots, or storage state.

- [ ] **Step 2: Write the protected-route and form smoke tests first**

Assert `/dashboard` redirects to `/login?next=%2Fdashboard`, login/signup/recovery pages show their accessible forms, locale survives navigation, theme toggles, and configured social buttons appear in the configured order.

- [ ] **Step 3: Run the smoke tests and confirm any missing behavior**

Run: `npm run test:e2e -- --project=chromium`

Expected before fixes: at least one assertion fails if integration wiring or accessibility names differ from the contract.

- [ ] **Step 4: Add the local email lifecycle test**

Generate a unique address under `example.test`, submit signup, and poll this URL until Mailpit returns the confirmation HTML:

```ts
const query = encodeURIComponent(`to:"${email}"`);
const messageUrl = `http://127.0.0.1:54324/view/latest.html?query=${query}`;
```

Extract only an `http://localhost:3000/auth/confirm` link, visit it, assert `/dashboard`, log out, log in again, request recovery, fetch the new matching message through the same Mailpit endpoint, open its `/auth/confirm` link, change the password, and verify login with the new password. Keep email helpers inside `e2e/auth.spec.ts` until a second test needs them, and give polling a 10-second deadline with 250-millisecond intervals.

- [ ] **Step 5: Fix only integration gaps exposed by the test and rerun**

Run:

```bash
npm run supabase:reset
npm run test:e2e -- --project=chromium
```

Expected: the full email lifecycle and route smoke tests pass. External OAuth is limited to button/configuration and callback contract tests.

- [ ] **Step 6: Commit browser coverage**

```bash
git add playwright.config.ts e2e supabase/config.toml package.json package-lock.json .gitignore
git commit -m "test: cover local authentication journeys"
```

## Task 12: Adopter Documentation and Secret-Free CI

**Files:**

- Create: `README.md`
- Create: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Modify: `package.json`

**Responsibilities:** Make the repository usable without prior Supabase knowledge and continuously verify everything that requires no external account credentials.

- [ ] **Step 1: Write a documentation acceptance checklist before the README**

The checklist must require exact instructions for prerequisites, local/cloud Supabase choices, environment values, migrations, email templates, password policy, each provider, redirects, branding, locale, Vercel, alternate Node hosting, test commands, and production hardening. It must explicitly tell readers not to share or commit secrets.

- [ ] **Step 2: Write the README from that checklist**

Link the provider sections to the official Supabase Google, Facebook, Apple, GitHub, Azure, and Discord guides. Explain that provider callback URLs point to Supabase, while Supabase allowed redirect URLs point back to the application. Include localhost, Vercel preview wildcard, and production examples. Document custom SMTP, provider app review, restricted redirect allowlists, password policy, rate limits, optional CAPTCHA, RLS tests, and Security Advisor review.

- [ ] **Step 3: Verify README commands against the package scripts**

Run every read-only/help command shown in the README and compare every named npm script with `npm run`. Search for accidental secret-looking JWTs or keys:

```bash
rg -n "service_role|sb_secret_|eyJ[A-Za-z0-9_-]{20,}|client_secret" . --glob '!docs/superpowers/**'
```

Expected: only warnings/documentation text, never an actual value.

- [ ] **Step 4: Add GitHub Actions CI**

On pushes and pull requests, use Node 24 with npm cache, run `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test:run`. Run `npm run build` with these explicit inert public values; do not add repository secrets:

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_ci_test_only
  NEXT_PUBLIC_SITE_URL: http://localhost:3000
  NEXT_PUBLIC_AUTH_PROVIDERS: ""
  NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true"
```

- [ ] **Step 5: Run the same secret-free verification locally**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: all commands exit 0 with the inert public CI environment set exactly as in the workflow.

- [ ] **Step 6: Commit documentation and CI**

```bash
git add README.md .github/workflows/ci.yml .env.example package.json
git commit -m "docs: add setup guide and CI"
```

## Task 13: Final Security and Release Verification

**Files:**

- Modify only files required to fix a demonstrated verification failure.

**Responsibilities:** Produce evidence that the starter satisfies the approved specification before calling it complete.

- [ ] **Step 1: Run the complete secret-free quality gate from a clean install**

Run:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run local database and browser integration checks**

With Docker running:

```bash
npm run supabase:start
npm run supabase:reset
npm run test:db
npm run test:e2e -- --project=chromium
```

Expected: database and browser suites pass. Capture the commands and summaries in the final handoff; do not commit generated reports.

- [ ] **Step 3: Audit auth boundaries and secrets**

Confirm protected layouts and profile queries call `getClaims()`, no server authorization relies on `getSession()`, every profile table operation is covered by grants plus RLS, redirect handlers use `safeNextPath`, and no secrets exist in tracked files. Run:

```bash
rg -n "getSession\(|service_role|sb_secret_|client_secret|provider_token" src supabase .env.example README.md
git grep -n "NEXT_PUBLIC_.*SECRET"
```

Expected: no unsafe auth call or secret usage; documentation warnings may match only when clearly marked as values never to add.

- [ ] **Step 4: Verify the working tree and review the final diff**

Run:

```bash
git status --short
git log --oneline --decorate -15
git diff HEAD~12..HEAD --check
```

Expected: clean working tree, focused task commits, and no whitespace errors. Adjust the revision range if fewer than 12 implementation commits exist, using the design commit as the base.

- [ ] **Step 5: Commit any verification-driven fix separately**

If and only if a preceding check exposed a defect, add the focused files, rerun the failing check plus its neighbors, and commit with a message describing that concrete fix. If every check passed, do not create an empty commit.
