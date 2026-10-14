import { describe, expect, it } from "vitest";
import { getVerifiedIdentity } from "./verified-identity";

function claimsClient(claims: unknown) {
  return {
    auth: {
      getClaims: async () => ({
        data: {
          claims,
          header: { alg: "RS256", typ: "JWT" },
          signature: new Uint8Array(),
        },
        error: null,
      }),
      getSession: async () => {
        throw new Error("getSession must not be used for identity");
      },
    },
  } as never;
}

describe("getVerifiedIdentity", () => {
  it("returns the verified subject and email from claims", async () => {
    const identity = await getVerifiedIdentity(
      claimsClient({ sub: "user-123", email: "reader@example.com" }),
    );

    expect(identity).toEqual({
      userId: "user-123",
      email: "reader@example.com",
    });
  });

  it.each([
    ["missing", { email: "reader@example.com" }],
    ["empty", { sub: "" }],
    ["non-string", { sub: 42 }],
  ])("returns null for a %s subject claim", async (_name, claims) => {
    expect(await getVerifiedIdentity(claimsClient(claims))).toBeNull();
  });

  it("omits a malformed optional email claim", async () => {
    expect(
      await getVerifiedIdentity(claimsClient({ sub: "user-123", email: 42 })),
    ).toEqual({ userId: "user-123" });
  });

  it("returns an identity when a required recovery AMR method is verified", async () => {
    const identity = await getVerifiedIdentity(
      claimsClient({
        sub: "user-123",
        email: "reader@example.com",
        amr: [{ method: "recovery", timestamp: 1_789_164_000 }],
      }),
      { requiredAuthMethod: "recovery" },
    );

    expect(identity).toEqual({
      userId: "user-123",
      email: "reader@example.com",
    });
  });

  it("rejects an identity without the required recovery AMR method", async () => {
    const identity = await getVerifiedIdentity(
      claimsClient({
        sub: "user-123",
        amr: [{ method: "password", timestamp: 1_789_164_000 }],
      }),
      { requiredAuthMethod: "recovery" },
    );

    expect(identity).toBeNull();
  });

  it("rejects malformed AMR data when an auth method is required", async () => {
    const identity = await getVerifiedIdentity(
      claimsClient({ sub: "user-123", amr: ["recovery"] }),
      { requiredAuthMethod: "recovery" },
    );

    expect(identity).toBeNull();
  });
});
