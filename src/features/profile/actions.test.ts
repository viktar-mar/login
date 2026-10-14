// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfileAction } from "./actions";

const boundary = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.createClient,
}));
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    displayName: " Reader ",
    avatarUrl: "https://example.com/avatar.png",
    ...values,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

function setup(response: unknown = { id: "verified-user" }, status = 200) {
  const requests: { url: URL; method?: string; body: unknown }[] = [];
  const client = createClient(
    "https://project.example",
    "test-publishable-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          requests.push({
            url: new URL(String(input)),
            method: init?.method,
            body: init?.body ? JSON.parse(String(init.body)) : null,
          });
          return Response.json(response, { status });
        },
      },
    },
  );
  const claims = vi.spyOn(client.auth, "getClaims").mockResolvedValue({
    data: {
      claims: {
        sub: "verified-user",
        iss: "https://project.example/auth/v1",
        aud: "authenticated",
        exp: 9999999999,
        iat: 1,
        role: "authenticated",
        aal: "aal1",
        session_id: "test-session",
      },
      header: { alg: "RS256", typ: "JWT", kid: "test-key" },
      signature: new Uint8Array(),
    },
    error: null,
  });
  boundary.createClient.mockResolvedValue(client);
  return { requests, claims };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProfileAction", () => {
  it("verifies claims on the write client and ignores all submitted identity and privileged fields", async () => {
    const { requests, claims } = setup();
    const result = await updateProfileAction(
      { status: "idle" },
      form({
        id: "victim-user",
        userId: "victim-user",
        role: "admin",
        created_at: "forged-date",
      }),
    );
    expect(result).toEqual({ status: "success" });
    expect(claims).toHaveBeenCalledTimes(1);
    expect(boundary.createClient).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe("/rest/v1/profiles");
    expect(requests[0].url.searchParams.get("id")).toBe("eq.verified-user");
    expect(requests[0].method).toBe("PATCH");
    expect(requests[0].body).toEqual({
      display_name: "Reader",
      avatar_url: "https://example.com/avatar.png",
    });
    expect(boundary.revalidate).toHaveBeenCalledWith("/profile");
  });

  it("rejects missing verified identity without any database request", async () => {
    const { requests, claims } = setup();
    claims.mockResolvedValue({ data: null, error: null });
    expect(await updateProfileAction({ status: "idle" }, form())).toEqual({
      status: "error",
      code: "unauthorized",
    });
    expect(requests).toHaveLength(0);
  });

  it.each([
    [{ displayName: "  " }, "displayName", "required"],
    [{ displayName: "x".repeat(101) }, "displayName", "too_long"],
    [{ avatarUrl: "javascript:alert(1)" }, "avatarUrl", "invalid_url"],
  ] as const)(
    "returns field error codes and does not write invalid input",
    async (values, field, code) => {
      const { requests } = setup();
      const result = await updateProfileAction(
        { status: "idle" },
        form(values),
      );
      expect(result).toMatchObject({
        status: "error",
        code: "validation",
        fieldErrors: { [field]: [code] },
      });
      expect(requests).toHaveLength(0);
    },
  );

  it("persists a cleared optional avatar as null", async () => {
    const { requests } = setup();
    expect(
      await updateProfileAction({ status: "idle" }, form({ avatarUrl: "" })),
    ).toEqual({ status: "success" });
    expect(requests[0].body).toEqual({
      display_name: "Reader",
      avatar_url: null,
    });
  });

  it.each([
    [null, 200],
    [
      {
        code: "42501",
        message: "private database detail",
        details: null,
        hint: null,
      },
      403,
    ],
  ] as const)(
    "does not report success for missing rows or database errors",
    async (response, status) => {
      setup(response, status);
      expect(await updateProfileAction({ status: "idle" }, form())).toEqual({
        status: "error",
        code: "unexpected",
      });
      expect(boundary.revalidate).not.toHaveBeenCalled();
    },
  );

  it("maps thrown infrastructure errors to a safe error state", async () => {
    boundary.createClient.mockRejectedValue(
      new Error("private infrastructure detail"),
    );
    expect(await updateProfileAction({ status: "idle" }, form())).toEqual({
      status: "error",
      code: "unexpected",
    });
  });
});
