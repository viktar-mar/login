# Generic Supabase Auth Starter

A production-minded Next.js starter for Supabase authentication. It includes email signup, login, password recovery, six optional OAuth providers, protected dashboard/profile routes, English and Russian UI, light/dark/system themes, a profile table with row-level security (RLS), database policy tests, and browser smoke tests.

You can begin with Supabase's free hosted plan; no existing Supabase account or paid service is required.

## Prerequisites

- Node.js 24 LTS (24.15 or later) and npm; Node.js 26+ is also supported. Node.js 25 is not supported by the test toolchain.
- A free [Supabase](https://supabase.com/) account for hosted use
- Docker only if you want the optional local Supabase stack or browser/database tests

The Supabase CLI is already a development dependency, so use the repository's Supabase scripts listed below instead of installing it globally.

## 1. Install and choose a Supabase environment

Install the locked dependencies:

```bash
npm ci
```

Choose one of these setups.

### Hosted Supabase (easiest first run)

1. Create a free project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Wait for it to finish provisioning.
3. In the project's Connect dialog or **Project Settings → API**, copy the project URL and the public publishable key. A legacy public `anon` key also works, but prefer the publishable key.
4. Continue with the environment file and hosted migration below.

### Local Supabase (optional)

Start Docker, then start the repository's configured stack:

```bash
npm run supabase:start
```

If optional logging containers are unhealthy on your machine, use:

```bash
npm run supabase:start -- --exclude vector,logflare
```

The command applies the migration and prints local service addresses. Copy only the local API URL and public publishable/anon key into your environment. Do not paste the CLI's full output into issues, chats, or logs because it also contains privileged keys. See Supabase's [local development guide](https://supabase.com/docs/guides/local-development) for background.

## 2. Configure the application environment

Create a local environment file from the safe example:

```bash
cp .env.example .env.local
```

Set all five values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_PROVIDERS=google,facebook,apple,github,azure,discord
NEXT_PUBLIC_ENABLE_EMAIL_AUTH=true
```

- `NEXT_PUBLIC_SUPABASE_URL`: the hosted project URL, or `http://127.0.0.1:54321` locally.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the public publishable key, or local public anon key. This is intentionally browser-visible and is safe only when RLS is correct.
- `NEXT_PUBLIC_SITE_URL`: the application's canonical origin, with no path or trailing slash. Use `http://localhost:3000` locally and the HTTPS production origin in production.
- `NEXT_PUBLIC_AUTH_PROVIDERS`: a comma-separated subset of `google,facebook,apple,github,azure,discord`. The list order is the button order. Use an empty value to hide all OAuth buttons.
- `NEXT_PUBLIC_ENABLE_EMAIL_AUTH`: `true` or `false`.

At least one login method must remain enabled. If email auth is `false`, configure at least one OAuth provider.

Never place secrets in a `NEXT_PUBLIC_*` variable: Next.js sends these values to browsers and may inline them into builds. Never share or commit `.env.local`, passwords, OAuth client secrets, Supabase secret or `service_role` keys, SMTP credentials, access/refresh tokens, or output containing them. This starter needs no privileged Supabase key.

## 3. Apply the database migration

The migration at `supabase/migrations/202609120001_create_profiles.sql` creates one profile per Auth user, restricts reads and updates to that user, and prevents browser clients from inserting/deleting profiles or changing identity/timestamp columns.

For the local stack, reset to the checked-in migrations:

```bash
npm run supabase:reset
```

This deletes local-only database data. For a new hosted project, follow Supabase's [database migration workflow](https://supabase.com/docs/guides/local-development/database-migrations), then run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Linking and pushing change the selected hosted project; verify its reference before confirming. If the hosted project already has schema changes, follow the official workflow to pull and reconcile them before pushing.

## 4. Configure email and password auth

In **Authentication → Providers → Email**:

1. Enable the Email provider and email confirmations.
2. Set the minimum password length to **8** so it matches `authConfig.passwordMinLength` in `src/config/auth.ts`. If you change the app rule, change the hosted rule to the same value.
3. Review the other [password security](https://supabase.com/docs/guides/auth/password-security) options for your audience.

### Hosted email templates: exact required links

In **Authentication → Email Templates**, update these two templates. This application intentionally uses different confirmation mechanisms.

**Confirm signup** must link to the application token-hash route:

```html
<a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
  Confirm email
</a>
```

`signUp` supplies the configured site origin as `.RedirectTo`. The application verifies the signup token with an isolated, non-persisting client and sends the user to `/login?confirmed=email`. The login page shows a localized confirmation and asks the user to sign in with their password. The email may be opened on a different device or browser: confirmation does not require the signup browser's cookies and never installs the link owner's session. An already signed-in visitor keeps their existing account instead of being switched to the account in the link.

Keep this token-hash template for signup. Using Supabase's complete confirmation URL instead would select a different flow with different session behavior. Password recovery intentionally uses that complete URL, as described below.

**Reset password** must use Supabase's complete confirmation URL:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

Password recovery uses same-browser PKCE. The app requests a redirect to `/auth/callback?next=%2Fupdate-password`; Supabase's confirmation URL performs verification and then returns the browser to that callback. The recovery email must be opened in the same browser that requested it so the PKCE verifier cookie is available.

Direct recovery links to `/auth/confirm?token_hash=...&type=recovery` are rejected. After changing an older recovery template, discard old recovery emails and request a new one. Existing messages do not acquire the new link format.

Both auth link handlers return `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Pragma: no-cache`, and `Expires: 0` on success and failure. The request proxy applies the same policy to protected and anonymous-only auth pages, even when no token refresh occurs, while preserving refreshed session cookies. Do not override these headers with CDN caching rules or enable ISR on authenticated routes; see Supabase's [SSR caching guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide#can-i-use-server-side-rendering-with-a-cdn-or-cache).

Compare with the checked-in `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`. Supabase documents the available variables in [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates). Without [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), Supabase's hosted default sender is for evaluation: signup and recovery messages can be sent only to email addresses belonging to members of the project's Supabase team. Configure custom SMTP before testing arbitrary alternate addresses or serving real users.

### Optional bot protection: Cloudflare Turnstile

CAPTCHA is disabled by default (`NEXT_PUBLIC_CAPTCHA_PROVIDER=none`). No Cloudflare script or token is required in this mode. To enable it for email/password sign-in, signup and password-recovery requests:

1. Create a **Managed** widget in [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/). Allow only the hostnames you operate (hostname only, without scheme or path). A Vercel hostname works; moving DNS to Cloudflare is not required. Leave pre-clearance disabled.
2. Set `NEXT_PUBLIC_CAPTCHA_PROVIDER=turnstile` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the widget's **public sitekey** in your app's deployment environment. These are build-time settings: rebuild/redeploy after changes. A missing sitekey prevents the app from starting rather than silently disabling protection.
3. In the corresponding **Supabase project → Authentication → Bot and Abuse Protection**, enable CAPTCHA, select **Turnstile**, and save the matching **secret key**. The secret belongs only in Supabase, never in this repository, Vercel variables or chat.
4. Verify all three email flows in a browser, including an expired challenge and retry. Check that direct Auth requests with a missing/invalid token are rejected by Supabase, not just by the UI. Keep an administrator session open during setup.

The widget alone does **not** protect the Auth API. Supabase must have CAPTCHA enabled: it performs the actual server-side verification, including expiration and one-time use. The app checks token shape and forwards it through the SDK's `captchaToken` option. Roll out both sides together in staging before production: enabling Supabase first temporarily blocks the old client; enabling only the app leaves the API unprotected. To roll back a coordinated rollout, disable Supabase CAPTCHA and deploy the app with `none`; neither setting disables the other automatically.

The compact widget fits narrow forms, follows the app's language/theme, and clears its token on submission, error or expiration. Failed script loading keeps submission disabled; retry reloads the page to make a fresh network request (email/password drafts are not retained across that reload). Password updates from a verified recovery session and social OAuth flows do not render this widget.

Use [Cloudflare's official dummy keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) only for isolated local/test environments. Never install dummy keys on a real hosted Auth project or rely on them for protection. Existing local Supabase E2E tests run with CAPTCHA disabled; the unit/integration suite additionally covers enabled-mode form lifecycle and the real SDK request payload. A real hosted CAPTCHA/email round trip still requires matching real keys and an allowed SMTP recipient.

## 5. Configure URLs correctly

Two kinds of redirect are easy to confuse:

- **Provider callback URL → Supabase.** Enter this in Google, Facebook, Apple, GitHub, Azure, or Discord. For hosted Supabase it is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`; the provider page in Supabase shows the exact value. For the local stack it is `http://127.0.0.1:54321/auth/v1/callback`.
- **Supabase redirect allowlist → your application.** Enter these under **Authentication → URL Configuration**. Supabase is allowed to return to these application URLs after signup, recovery, or OAuth.

Set **Site URL** to the canonical application origin. For local development use `http://localhost:3000`. For production use, for example, `https://app.example.com`.

Add only the application destinations you operate:

```text
http://localhost:3000/**
https://*-your-team.vercel.app/**
https://app.example.com/auth/callback
https://app.example.com/auth/callback?next=%2Fupdate-password
```

Supabase supports wildcard patterns for preview deployments; follow its [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls) and scope the Vercel wildcard to your team/project pattern. The wildcard only authorizes a destination—it does not make this application discover the current preview origin. Each preview that tests auth must be built with its own exact origin in `NEXT_PUBLIC_SITE_URL`, or auth testing must use a stable configured deployment. Prefer exact URLs for production. Do not add attacker-controlled domains, broad production wildcards, or token values. Signup confirmation begins at the Site URL and appends `/auth/confirm`; it does not require the social-provider callback URL.

## 6. Add social login providers

For each provider you want:

1. Open the official Supabase guide below and create the provider application/credentials.
2. Put the **Supabase callback URL**, not the application callback, in the provider's redirect/callback field.
3. Store the client ID and client secret only in **Supabase Dashboard → Authentication → Providers**. Never put a provider secret in `.env.local` or a `NEXT_PUBLIC_*` variable.
4. Enable the provider in Supabase and add its exact identifier to `NEXT_PUBLIC_AUTH_PROVIDERS`.
5. Test with an account allowed by the provider's current development/test mode.

Provider guides:

- [Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook)
- [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Azure (Microsoft)](https://supabase.com/docs/guides/auth/social-login/auth-azure) — the environment/provider identifier remains `azure`.
- [Discord](https://supabase.com/docs/guides/auth/social-login/auth-discord)

Provider portals vary in consent screens, test-user restrictions, domain verification, privacy-policy requirements, and app review. Complete the provider's current production review/verification process before opening login to real users. A button in the starter does not make an unreviewed provider app production-ready.

### Staging OAuth status — 2026-10-19

These results apply to the isolated site `https://login-staging.vercel.app`, not to every application created from this starter:

- **Google: verified.** Google is enabled in the staging Supabase project, and Vercel's Production environment for `login-staging` uses `NEXT_PUBLIC_AUTH_PROVIDERS=google`. After redeployment, the browser reached Google's account chooser; the user completed Google sign-in and confirmed access to the protected dashboard. The Google app remains in **Testing** mode with configured test users; this is not approval for public production use.
- **Apple: awaiting Apple Developer Support.** Membership is active, but no App ID, Services ID, or signing key has been configured for this integration. An inquiry was submitted about web-only eligibility and testing before publishing a native App Store application. Apple remains disabled and real sign-in is untested pending clarification of [Apple's requirements](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple).
- **Facebook: awaiting Meta support.** Developer registration is blocked by the missing phone-verification SMS code. Facebook remains disabled and real sign-in is untested; the underlying delivery issue has not been established.
- GitHub, Azure (Microsoft), and Discord remain optional, disabled on staging, and untested with real provider accounts.

Email/password and Turnstile remain enabled, and the verified Vercel build workaround `NEXT_ENABLE_ADAPTER=0` is retained. The successful Google round trip was completed manually by the user; it is not an automated OAuth test or a fresh regression run of the email flows. See the [detailed OAuth checkpoint](docs/superpowers/plans/2026-09-12-generic-supabase-auth-starter.md#google-oauth-verified-and-provider-support-pending--2026-10-19) for deployment evidence and remaining boundaries. Provider credentials stay in Supabase; this status does not change the generic starter's defaults.

## 7. Run the app and customize it

Start development:

```bash
npm run dev
```

Open `http://localhost:3000`. The theme switcher supports light, dark, and system preferences.

### Brand and colors

- Set the product name, description/metadata, logo path, and post-login destination in `src/config/site.ts`. Home branding, navigation, and auth screens share these settings.
- Replace `public/logo.svg` or add your own local logo and set `siteConfig.logo` to its path.
- Edit localized headings and visible copy in the enabled dictionaries in `src/i18n/dictionaries`.
- Customize the CSS variables in **both** `:root` and `.dark` in `src/app/globals.css`. Shared tokens such as `--primary`, `--primary-foreground`, `--background`, and `--foreground` control the home page and auth controls. Keep text/background contrast accessible.

### Optional languages and adding a language

English and Russian are provided, but neither the switcher nor the server assumes that both are enabled. For an English-only site, set `locales: ["en"]` and `defaultLocale: "en"` in `src/config/site.ts`. Keep at least one language enabled. If the default is disabled, the first enabled language is used as the fallback.

To add another language:

1. Add a dictionary, for example `src/i18n/dictionaries/fr.ts`, with the same keys as English and `satisfies Dictionary` (import the type from `../types`). Translate its visible strings.
2. Import it into `src/i18n/registry.ts` and add its valid BCP 47 language code to `dictionaries`, for example `{ en, ru, fr }`. The `Locale` type is derived from that registry; do not edit a separate union.
3. Add the code to `siteConfig.locales` and optionally choose it as `defaultLocale`. Array order is switcher order. Language names are supplied by `Intl.DisplayNames`, so you do not need to add a language-name key to every dictionary.
4. Run type, unit, and browser checks. Test language selection, reload/navigation, and an old cookie from a disabled language. The included third-language unit fixture proves registry extensibility; it is not a shipped French translation.

Locale resolution uses an enabled cookie value, then weighted `Accept-Language`, then the configured fallback. Disabled/unknown locale action inputs are ignored without changing the cookie. Routes remain `/login`, `/signup`, etc.; locale selection does not change URLs.

## Tests and verification

The checks that need no external credentials are:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:run
npm run build
```

`npm run verify` runs that same sequence. CI uses inert public values and no repository secrets.

Check dependencies with `npm audit --omit=dev` and `npm audit`. The locked production dependencies were updated for the October 2026 security advisories. The Next.js ESLint plugin still pulls in the development-only `fast-glob → micromatch → braces` chain, for which the current audit has no compatible upstream fix. Do not run lint on untrusted checkouts/patterns, and recheck for an upstream fix before each release. This exception does not apply to the production runtime; do not use `npm audit fix --force` to downgrade Next.js tooling to a different major version.

On a host where Turbopack's production build is blocked by sandbox process/network restrictions, use the supplemental Webpack check:

```bash
npm run build:webpack
```

This does not replace the required `npm run build` in CI.

Database and browser tests require the local Supabase stack:

```bash
npm run test:db
npx playwright install chromium
npm run test:e2e -- --project=chromium
```

On a fresh Debian/Ubuntu Linux machine or CI runner that also needs Chromium's operating-system packages, install both together instead:

```bash
npx playwright install --with-deps chromium
```

Before the browser suite, stop any manually running development server or other process on port 3000. Playwright deliberately starts its own app server with `reuseExistingServer: false` so the browser uses the test-specific public configuration; it will not reuse `npm run dev`. If the local health check fails because optional logging services are unhealthy, restart with `npm run supabase:start -- --exclude vector,logflare`. The browser suite uses local Mailpit and configured provider buttons; it does not need real provider credentials.

To see every repository script:

```bash
npm run
```

## Deploy

### Vercel

Import the repository into Vercel following the official [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) guide. Keep the framework preset as Next.js and set the five environment variables from `.env.example` for the appropriate Development, Preview, and Production environments.

For the Production environment, set `NEXT_PUBLIC_SITE_URL` to the canonical production origin. For a Vercel Preview that will test OAuth or password recovery, the build pipeline must set `NEXT_PUBLIC_SITE_URL` to that preview's exact HTTPS origin before `npm run build` (for example, `https://my-app-git-feature-my-team.vercel.app`). The application builds OAuth and recovery callbacks exclusively from this value and does not automatically read Vercel's deployment URL. If a preview is built with the production value, auth returns to production; same-browser PKCE recovery then loses its verifier cookie because the origins differ.

If your pipeline does not inject the exact origin into every preview build, limit auth testing to a stable staging deployment/custom domain with its own fixed `NEXT_PUBLIC_SITE_URL` and exact Supabase allowlist entries. Do not test auth on ephemeral previews in that setup. A project/team-scoped Supabase wildcard merely permits matching preview redirects; it is not sufficient by itself.

Provider callback URLs still point to Supabase, never to Vercel. Add the production callback, the exact stable staging callback if used, and only the necessary scoped preview wildcard to Supabase's redirect allowlist. Redeploy after changing any `NEXT_PUBLIC_*` value because those values are compiled into browser bundles.

#### Optional Vercel Auth rate-limit observation

This starter does not require Vercel Firewall, an extra SDK, Redis, or a privileged Supabase key. On Vercel, you can optionally observe the combined email/password login, signup, and recovery request rate by the **client IP**. This is a project setting, not application configuration; copying the repository or deploying on another host does not enable it.

Use Vercel's [Server Action Name condition](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration), supported with Next.js 15.5+, instead of relying only on `/login`, `/signup`, and `/forgot-password` paths. Server Actions can be invoked from other pages, and their generated IDs change between builds. The matcher below selects the three source-file/export names, allowing both `features/...` and `src/features/...` manifest paths. If you move the action module or rename its exports, update the rule and verify matching again.

**Build compatibility checkpoint (2026-10-16):** with Next.js 16.3.8 and Vercel's new Next.js adapter, isolated tests did not attribute matching requests to this rule. The legacy builder restored Server Action name metadata and produced the expected exceedance logs with the same matcher. This is a verified workaround for that build combination, not a permanent requirement for every Vercel project.

For a deployment using this workaround:

1. In the intended Vercel project's **Settings → Environment Variables**, set the build-time configuration `NEXT_ENABLE_ADAPTER=0` for **Production** and **Preview**. It is not a secret, a `NEXT_PUBLIC_*` variable, or an application auth setting; it is deliberately not part of the generic `.env.example`.
2. Rebuild/redeploy. Keep the Next.js framework preset and the normal `npm run build` command; this does not switch the app from Turbopack to Webpack. Existing deployments do not acquire the setting retroactively.
3. Verify the resulting deployment's auth flows and WAF attribution before relying on the rule. Recheck in an isolated deployment after Next.js or Vercel builder upgrades, and remove the workaround only after equivalent matching is verified. Do not infer counter attribution from successful page loads, HTTP 200 responses, or an empty log view.

Start with a **log-only** [rate-limit rule](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting): 60 combined requests per IP per 60-second fixed window. This is an initial observation threshold, not a production recommendation. Exceeding it must only log, never deny, challenge, or return 429. Counters are per Vercel region, not a globally exact limit. Hobby currently includes one rate-limit rule per project and 1,000,000 allowed requests; review the current plan, pricing, and existing rule usage before publishing. Do not enable a paid plan or add-on just for this step.

With an authenticated Vercel CLI, replace both placeholders with the intended project and personal account/team scope. Verify the owner and existing drafts before staging anything. Do not use a working organization or auto-link to a different project:

```bash
vercel project inspect YOUR_PROJECT_ID --scope YOUR_PERSONAL_SCOPE --non-interactive
vercel firewall rules list --project YOUR_PROJECT_ID --scope YOUR_PERSONAL_SCOPE --json --non-interactive
vercel firewall diff --project YOUR_PROJECT_ID --scope YOUR_PERSONAL_SCOPE --json --non-interactive
```

If a matching rule already exists, inspect it instead of creating a duplicate. If there are unrelated drafts, stop and coordinate with their owner; publishing applies all pending firewall changes. Otherwise, stage this rule (it does **not** publish it):

```bash
vercel firewall rules add 'Auth email actions - observe' \
  --project YOUR_PROJECT_ID --scope YOUR_PERSONAL_SCOPE \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --condition '{"type":"server_action","op":"re","value":"(^|/)features/auth/actions[.]ts#(loginAction|signupAction|forgotPasswordAction)$"}' \
  --action rate_limit \
  --rate-limit-window 60 --rate-limit-requests 60 \
  --rate-limit-keys ip --rate-limit-action log \
  --yes --non-interactive

vercel firewall rules inspect 'Auth email actions - observe' \
  --project YOUR_PROJECT_ID --scope YOUR_PERSONAL_SCOPE --json --non-interactive
vercel firewall diff --project YOUR_PROJECT_ID --scope YOUR_PERSONAL_SCOPE --json --non-interactive
```

Verify that the only intended change is this rule and its nested `rateLimit.action` is `log`. Then the project owner can open **Firewall → Review Changes → Publish** in Vercel. A draft observes nothing until published. Keep it in log-only mode while reviewing traffic at `https://vercel.com/YOUR_PERSONAL_SCOPE/YOUR_PROJECT_NAME/firewall/traffic?filter=YOUR_RULE_ID`; no background monitoring is installed by this repository.

After publication, verify real submissions for all three forms and confirm Vercel resolves their expected Server Action names. Also check that page GETs, OAuth, sign-out, profile edits, and recovery password updates are outside this rule. Ordinary submissions below the threshold may not create an exceedance log; absence of logs alone does not prove matching. Do not flood the real Auth API to force a log or consume SMTP quotas. Inspect matching request metadata in the dashboard; do not share passwords, CAPTCHA tokens, cookies, email links, or raw request bodies. Only tighten or enforce after reviewing representative traffic, including users sharing an IP, and testing enforcement in an isolated preview with a separately reviewed change. Roll back a live rule by disabling that rule or returning it to log-only, reviewing the diff, and publishing again; never discard unrelated drafts.

This rule reduces application-side abuse only once enforcement is explicitly enabled. It does **not** change the IP Supabase sees for server-side Auth requests, protect direct calls to Supabase, raise project-wide email quotas, or prevent proxy/session-refresh calls made before Server Action matching. Keep Supabase CAPTCHA and Auth limits configured independently. Supabase [IP forwarding](https://supabase.com/docs/guides/auth/rate-limits#ip-address-forwarding) requires explicit enablement and a modern secret API key; adding a header with this starter's publishable key is not a solution. Do not add a privileged key or loosen Supabase limits to make this observation rule work.

#### Verified staging checkpoint — 2026-10-16 UTC

- The isolated hosted application at `https://login-staging.vercel.app` was rebuilt with `NEXT_ENABLE_ADAPTER=0`. The user confirmed a real password login after CAPTCHA and access to the dashboard on the updated deployment. Real signup/confirmation and password recovery had passed earlier; their email round trips were not repeated after this rebuild.
- Missing-CAPTCHA submissions to all three email Server Actions returned `captcha_failed` with a CAPTCHA field error before creating a Supabase client. A direct Supabase password-login request without CAPTCHA also returned HTTP 400 / `captcha_failed`. Anonymous dashboard and profile requests redirected to login.
- With explicit user approval, exactly 61 synthetic login submissions ran within one minute in edge region `cdg1`, without CAPTCHA. CDN records showed 60 `allow` actions followed by one `log`; the rule-specific exceedance counter increased from zero to one. All 61 submissions stopped at application validation, with no Supabase Auth requests, created users, or sent emails. HTTP 200 was only the Server Action transport status, not successful authentication.
- The live rule remained at 60 requests per IP per 60 seconds in **Log** mode, with no unpublished changes. This proves observation on the tested deployment, not enforced blocking or production readiness. At that checkpoint, live OAuth testing was still pending; the later Google result is recorded in [Staging OAuth status](#staging-oauth-status--2026-10-19). A verified SMTP sending domain for other recipients and release-time security/dependency review remain separate work.

The detailed comparison, rollout, cleanup, and verification boundaries are recorded in the [implementation checkpoint](docs/superpowers/plans/2026-09-12-generic-supabase-auth-starter.md#verified-legacy-builder-and-staging-waf-counter--2026-10-16-utc). Reproduce exceedance tests only with explicit approval and safe synthetic inputs that stop before the Auth API; do not repeat them automatically or consume real email quotas.

### Any Node.js host

Use a supported Node.js host (24.15–24.x or 26+) that provides a persistent Next.js server, HTTPS, environment variables, and forwarded cookies/headers:

```bash
npm ci
npm run build
npm run start
```

Set the same five environment variables before the build and at runtime, expose the host's assigned port, and terminate TLS at the platform or reverse proxy. Follow the official Next.js [self-hosting/deployment guidance](https://nextjs.org/docs/app/getting-started/deploying). Serverless/static-only platforms that cannot run `next start` need a platform-specific Next.js adapter and are outside this starter's generic Node path.

## Production hardening checklist

- Replace local/preview configuration with exact HTTPS production origins. Keep the Supabase redirect allowlist narrow and periodically remove stale preview URLs.
- Configure custom SMTP, verify its sending domain, and test signup/recovery delivery. Never expose SMTP credentials.
- Complete every OAuth provider's consent-screen setup, domain verification, test-to-live transition, and required app review.
- Match Supabase's minimum password length to the application's 8-character validation; consider stronger requirements appropriate to your threat model.
- Review and tune Supabase [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). Add optional [CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha) for public signup/recovery abuse.
- Keep RLS enabled. After every schema or policy change, start local Supabase and run `npm run test:db`; add policy tests for every new user-owned table. Review the [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Run the Supabase Dashboard's [Security Advisor](https://supabase.com/docs/guides/observability/advisors) before release and review its findings after database changes.
- Use HTTPS, secure your deployment account with MFA, restrict team access, rotate any exposed credential immediately, and keep Node/dependencies updated.
- Never log, share, or commit user passwords, provider client secrets, SMTP credentials, secret/service-role keys, access/refresh tokens, or real environment files.

## Useful scripts

| Script                   | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `npm run dev`            | Start the Next.js development server                                   |
| `npm run build`          | Required production build (Turbopack)                                  |
| `npm run build:webpack`  | Supplemental production build for restricted hosts                     |
| `npm run start`          | Serve a completed production build                                     |
| `npm run test:run`       | Run unit/component tests once                                          |
| `npm run test:e2e`       | Run Playwright browser tests against local Supabase                    |
| `npm run supabase:start` | Start the local Supabase stack                                         |
| `npm run supabase:stop`  | Stop this project's local stack                                        |
| `npm run supabase:reset` | Rebuild the local database from migrations (destructive to local data) |
| `npm run test:db`        | Run pgTAP database/RLS tests                                           |
| `npm run verify`         | Run format, lint, types, unit tests, and required build                |
