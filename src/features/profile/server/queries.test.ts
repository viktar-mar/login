// @vitest-environment node
import { AuthError, createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getOwnProfile } from "./queries";

const profile = {
  id: "verified-user",
  display_name: "Reader",
  avatar_url: null,
  created_at: "2026-09-12T12:00:00Z",
  updated_at: "2026-09-12T12:00:00Z",
};

function setup(response: unknown = [profile], status = 200) {
  const requests: URL[] = [];
  const client = createClient(
    "https://project.example",
    "test-publishable-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          requests.push(new URL(String(input)));
          return Response.json(response, { status });
        },
      },
    },
  );
  const claimsData = {
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
  };
  const claims = vi.spyOn(client.auth, "getClaims").mockResolvedValue({
    data: claimsData,
    error: null,
  });
  const from = vi.spyOn(client, "from");
  return { client, claims, claimsData, from, requests };
}

describe("getOwnProfile", () => {
  it("requests only the claim-derived owner's profile and explicit safe columns", async () => {
    const { client, requests } = setup();

    // A runtime caller cannot override ownership with the removed ID argument.
    expect(
      await Reflect.apply(getOwnProfile, undefined, [client, "victim-user"]),
    ).toEqual(profile);
    expect(requests).toHaveLength(1);
    expect(requests[0].pathname).toBe("/rest/v1/profiles");
    expect(requests[0].searchParams.get("id")).toBe("eq.verified-user");
    expect(requests[0].searchParams.get("select")).toBe(
      "id,display_name,avatar_url,created_at,updated_at",
    );
  });

  it.each(["absent", "invalid", "empty subject"] as const)(
    "does not query profiles when verified claims are %s",
    async (failure) => {
      const { client, claims, claimsData, from, requests } = setup();
      if (failure === "absent") {
        claims.mockResolvedValue({ data: null, error: null });
      } else if (failure === "invalid") {
        claims.mockResolvedValue({
          data: null,
          error: new AuthError("Invalid claims"),
        });
      } else {
        claims.mockResolvedValue({
          data: {
            ...claimsData,
            claims: { ...claimsData.claims, sub: "" },
          },
          error: null,
        });
      }

      const result = await getOwnProfile(client);
      expect(from).not.toHaveBeenCalled();
      expect(requests).toHaveLength(0);
      expect(result).toBeNull();
    },
  );

  it("returns null when no own profile is visible", async () => {
    const { client } = setup([]);
    expect(await getOwnProfile(client)).toBeNull();
  });

  it("does not disguise database failures as a missing profile", async () => {
    const { client } = setup(
      {
        message: "private database detail",
        code: "42501",
        details: null,
        hint: null,
      },
      403,
    );
    await expect(getOwnProfile(client)).rejects.toThrow(
      "Unable to load profile",
    );
  });
});
