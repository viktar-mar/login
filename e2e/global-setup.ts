export default async function globalSetup() {
  for (const [name, url] of [
    ["Supabase Auth", "http://127.0.0.1:54321/auth/v1/health"],
    ["Mailpit", "http://127.0.0.1:54324/livez"],
  ]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error("Unhealthy service");
    } catch {
      throw new Error(
        `${name} is not reachable locally. Run npm run supabase:start -- --exclude vector,logflare before browser tests.`,
      );
    }
  }
}
