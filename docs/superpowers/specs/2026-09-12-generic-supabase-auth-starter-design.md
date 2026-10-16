# Generic Supabase Auth Starter — Design

Date: 2026-09-12

## Summary

Build a reusable web authentication starter that can be copied for new sites. The starter uses React through Next.js, TypeScript, Tailwind CSS, and Supabase Auth. It includes a complete email/password flow, configurable social login, a minimal user profile, localization, theme customization, a protected example area, tests, and deployment documentation.

The primary deployment target is Vercel with a hosted Supabase project. The application remains compatible with other Node.js hosting platforms, and a local Supabase stack is optional for integration testing.

## Goals

- Make authentication reusable by copying the repository and changing configuration rather than auth components.
- Support email/password registration and login, email verification, logout, password recovery, and password update.
- Support Google, Facebook, Apple, GitHub, Microsoft (Supabase provider name `azure`), and Discord.
- Allow every login method to be enabled or disabled independently.
- Provide English and Russian interfaces without locale-prefixed URLs.
- Provide a minimal protected dashboard and editable user profile as integration examples.
- Use Supabase cookie-based SSR correctly for browser and server rendering.
- Ship database migrations, automated checks, and setup documentation suitable for repeated use.
- Keep secrets out of source control and out of browser-visible configuration.

## Non-goals

- Roles, organizations, teams, invitations, or multi-tenant authorization.
- Magic links, one-time passwords, phone login, passkeys, MFA, or enterprise SSO.
- A published npm authentication package or monorepo.
- Provider API access on behalf of a user or storage of provider access tokens.
- A custom administrative user-management interface.
- Production email delivery infrastructure beyond documenting Supabase SMTP configuration.

These features can be added to a copied application when its product requirements are known.

## Architecture

The project is a standalone Next.js application using React, TypeScript, and the App Router. It owns its UI and composes Supabase through a small adapter layer.

```text
src/
├── proxy.ts             # request hook; delegates to Supabase adapter
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── update-password/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   └── profile/
│   └── auth/
│       ├── callback/    # OAuth PKCE code exchange
│       └── confirm/     # email token-hash verification
├── components/ui/
├── config/
│   ├── auth.ts
│   └── site.ts
├── features/auth/
├── i18n/
└── lib/supabase/
    ├── client.ts
    ├── server.ts
    └── proxy.ts

supabase/
├── config.toml
├── migrations/
└── tests/
```

The exact stable dependency versions are selected when the application is scaffolded and committed in the lockfile. Application code imports Supabase browser, server, and request-proxy clients only from `src/lib/supabase`. This boundary limits the impact of future changes to `@supabase/ssr`, whose API Supabase currently marks as beta.

## Configuration

`src/config/site.ts` contains public product identity and navigation defaults:

```ts
export const siteConfig = {
  name: "Your Product",
  description: "Your product description",
  logo: "/logo.svg",
  defaultLocale: "en",
  locales: ["en", "ru"],
  afterLoginPath: "/dashboard",
} as const;
```

`src/config/auth.ts` contains authentication behavior that must stay aligned with the corresponding Supabase project settings, including a default minimum password length of 8 characters and the supported provider registry.

Environment variables control deployment-specific behavior:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_PROVIDERS=google,facebook,apple,github,azure,discord
NEXT_PUBLIC_ENABLE_EMAIL_AUTH=true
```

Configuration is parsed and validated once. Unknown provider names, an empty authentication-method set, malformed URLs, and missing Supabase values fail with a clear startup/configuration error.

OAuth client IDs and secrets are entered in Supabase and the provider's developer console. They are never placed in this application's public or server environment. The application never requires a Supabase `service_role` key.

## User Interface

The authentication pages use a responsive centered-card layout. Reusable UI primitives live in the repository, follow shadcn/ui conventions, and are styled with Tailwind CSS. This avoids coupling the starter to a hosted theme or opaque component package.

The theme uses CSS custom properties for colors, spacing, radius, and light/dark palettes. A copied project can replace the logo and adjust tokens without changing auth flows. The UI includes keyboard-visible focus states, semantic labels, accessible status messages, disabled/loading states, and responsive layouts.

The login and signup pages render email/password forms only when email auth is enabled. Social buttons are generated from the ordered provider configuration. Each supported provider has local display metadata such as label and icon, while Supabase receives the canonical provider identifier.

## Localization

English and Russian dictionaries contain all user-facing labels, validation messages, errors, and setup-independent auth status text. URLs are not locale-prefixed.

Locale resolution order is:

1. A validated locale cookie set by the language switcher.
2. A supported language from the request's `Accept-Language` header.
3. `siteConfig.defaultLocale`.

English is the dictionary fallback for a missing translation key. Adding a language requires a new dictionary and adding its code to `siteConfig.locales`; auth components do not change.

## Authentication Flows

### Email and password

- Signup validates fields, enforces the configured minimum password length of 8 characters, calls Supabase Auth, and redirects to a neutral "check your email" state when email confirmation is required.
- Login uses password authentication and sends authenticated users only to a validated local `next` path or `siteConfig.afterLoginPath`.
- Forgot-password requests send a recovery email whose verified destination is `/update-password`.
- `/auth/confirm` accepts only `type=email` and a single `token_hash`, calls `verifyOtp` with an isolated non-persisting client, and removes sensitive query parameters. It never reads or installs the visitor's auth cookies: confirmation may be opened in another browser without replacing an existing account. Signup confirmation continues to `/login?confirmed=email`, which displays a localized notice asking the user to sign in with their password.
- Recovery uses Supabase's complete confirmation URL and a same-browser PKCE exchange at `/auth/callback?next=%2Fupdate-password`. Update-password requires that verified recovery session and recovery authentication method before accepting a new password.
- Auth link responses and protected/anonymous-only auth pages explicitly prohibit browser and shared-cache storage on success and failure, including redirects without token refresh. Refreshed session cookies and SDK cache headers are preserved.
- Logout clears the Supabase session and redirects to `/login`.

Client-side validation improves feedback, but server actions validate the same inputs again before calling Supabase. The setup guide instructs adopters to set the Supabase minimum password length to the same value as `authConfig.passwordMinLength` whenever they customize it. The signup template uses `{{ .TokenHash }}` and the recovery template uses `{{ .ConfirmationURL }}`; their different session behavior is documented explicitly.

### Social login

The provider action calls `signInWithOAuth` using the configured provider and `/auth/callback` as the application callback. Supabase handles provider-specific OAuth exchange. The callback route exchanges the PKCE authorization code for a Supabase session, validates the optional `next` path as local, and redirects to the protected destination.

Invalid, expired, denied, or incomplete callbacks return to `/login` with a safe localized error code. Raw provider errors and secrets are not included in browser URLs or UI messages.

### Session and route protection

Supabase sessions are stored in cookies through `@supabase/ssr`. Separate factories create browser and server clients. The Next.js request proxy refreshes auth cookies and performs fast route redirects.

Protected layouts and data-access functions independently call `supabase.auth.getClaims()` before returning protected UI or data. Proxy redirects are a convenience and are not the only authorization boundary. Authenticated users visiting login or signup are redirected to the configured post-login page.

## Profile Data

The `public.profiles` table contains:

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key; references `auth.users(id)` with cascade deletion |
| `display_name` | `text` | Nullable and length-constrained |
| `avatar_url` | `text` | Nullable |
| `created_at` | `timestamptz` | Non-null server default |
| `updated_at` | `timestamptz` | Non-null server default; maintained on update |

A database trigger creates the profile after insertion into `auth.users`. It safely derives an initial display name and avatar from provider metadata, tolerates missing metadata, uses fully qualified object names, and fixes its `search_path`.

Row Level Security is enabled. Authenticated users may select and update only the profile whose `id` equals `auth.uid()`. Direct profile creation is not granted to clients because the trigger owns creation. No anonymous profile access is allowed.

## Error Handling

The application maps Supabase and validation failures to a small set of stable internal error codes. Dictionaries turn those codes into localized messages. Expected failures appear next to the relevant form or in an accessible page-level alert.

Unexpected server errors are logged without passwords, tokens, authorization codes, or provider secrets. The browser receives a generic failure message. Redirect parameters are allowlisted as local application paths to prevent open redirects.

Loading and submission states prevent accidental duplicate actions. Password reset and signup responses avoid unnecessary account-existence disclosure.

## Testing and Quality Gates

Every change must pass:

- formatting and lint checks;
- TypeScript type checking;
- unit tests for configuration parsing, locale resolution, safe redirects, validation, and error mapping;
- component tests for auth forms, provider ordering/visibility, loading states, language switching, and accessible error output;
- database tests for profile creation and RLS isolation;
- Playwright smoke tests for email signup/login/recovery, protected-route redirects, and callback failure handling.

Email integration tests use the optional local Supabase stack and its test inbox. Third-party OAuth providers are not exercised end-to-end in CI because they require external interactive accounts; tests cover provider configuration, generated redirects, buttons, and callback behavior instead.

CI runs the checks that do not require external provider credentials. Supabase-backed tests run against the local stack when Docker and Supabase CLI are available.

## Documentation and Operator Setup

The README guides a new adopter through:

1. Installing dependencies and starting the application.
2. Creating a free hosted Supabase project.
3. Copying `.env.example` to `.env.local` and adding the project URL and publishable key.
4. Applying database migrations.
5. Configuring Site URL and allowed redirect URLs for localhost, Vercel previews, and production.
6. Enabling email/password, setting the matching password policy, and installing SSR-compatible confirmation and recovery email templates.
7. Enabling each social provider, creating provider applications, and entering their callback URLs, IDs, and secrets in the correct consoles.
8. Customizing branding, theme tokens, languages, enabled providers, and the post-login route.
9. Deploying to Vercel and setting environment variables.
10. Completing a production checklist covering custom SMTP, redirect restrictions, provider app review, password policy, rate limits, CAPTCHA as an optional hardening step, and Supabase security advisors.

Provider instructions link to the official Supabase pages rather than duplicating console screens that may change.

## Acceptance Criteria

- A developer can clone the starter, provide Supabase public configuration, apply migrations, and run it locally.
- Email/password signup, confirmation, login, logout, recovery, and password update work with a configured Supabase project.
- Any supported social provider can be shown or hidden by configuration without changing UI components.
- A successful login reaches `/dashboard`; an unauthenticated request to protected routes returns to `/login` with a safe continuation path.
- A user can view and update only their own profile.
- English and Russian can be switched without changing the URL, and the preference persists.
- Branding and theme tokens can be changed without modifying authentication logic.
- No application secret or `service_role` key is committed or exposed to the browser.
- Automated checks and the documented setup path pass before the starter is considered complete.

## References

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase server-side rendering](https://supabase.com/docs/guides/auth/server-side)
- [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Supabase social login](https://supabase.com/docs/guides/auth/social-login)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)
