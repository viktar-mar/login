import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "./require-user";

const boundary = vi.hoisted(() => ({ createClient: vi.fn(), claims: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.createClient,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`redirect:${path}`);
  },
}));

const client = {
  auth: {
    getClaims: boundary.claims,
    getSession: () => {
      throw new Error("Unverified sessions cannot authorize access");
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  boundary.createClient.mockResolvedValue(client);
  boundary.claims.mockResolvedValue({
    data: { claims: { sub: "verified-user", email: "reader@example.com" } },
    error: null,
  });
});

describe("requireUser", () => {
  it("returns only verified identity and the same request client", async () => {
    expect(await requireUser()).toEqual({
      supabase: client,
      userId: "verified-user",
      email: "reader@example.com",
    });
    expect(boundary.createClient).toHaveBeenCalledTimes(1);
    expect(boundary.claims).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { sub: "" }, { sub: 123 }])(
    "redirects invalid claims %j before granting access",
    async (claims) => {
      boundary.claims.mockResolvedValue({ data: { claims }, error: null });
      await expect(requireUser("/profile")).rejects.toThrow(
        "redirect:/login?next=%2Fprofile",
      );
    },
  );

  it("rejects claims accompanied by a verification error", async () => {
    boundary.claims.mockResolvedValue({
      data: { claims: { sub: "forged-user" } },
      error: new Error("invalid signature"),
    });
    await expect(requireUser()).rejects.toThrow(
      "redirect:/login?next=%2Fdashboard",
    );
  });

  it.each([
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
  ])("sanitizes unsafe continuation %s", async (next) => {
    boundary.claims.mockResolvedValue({ data: null, error: null });
    await expect(requireUser(next)).rejects.toThrow(
      "redirect:/login?next=%2Fdashboard",
    );
  });
});
