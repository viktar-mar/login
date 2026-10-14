import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function localSupabaseEnvironment() {
  let status: Record<string, string>;
  try {
    // Capture CLI output in memory: status also contains privileged keys, which
    // must never be printed, written to disk, or passed to the browser server.
    status = JSON.parse(
      execFileSync(
        resolve("node_modules/.bin/supabase"),
        ["status", "--output", "json"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10_000,
        },
      ),
    );
  } catch {
    throw new Error(
      "Local Supabase is not reachable. Start Docker, then run npm run supabase:start -- --exclude vector,logflare before browser tests.",
    );
  }

  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (status.API_URL !== "http://127.0.0.1:54321" || !publicKey) {
    throw new Error(
      "Browser tests require local Supabase on port 54321 and its public key.",
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
    NEXT_PUBLIC_AUTH_PROVIDERS: "github,google,azure",
  };
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname localhost --port 3000",
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: localSupabaseEnvironment(),
  },
});
