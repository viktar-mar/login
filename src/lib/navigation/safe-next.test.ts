import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("preserves a local path with query parameters", () => {
    expect(safeNextPath("/profile?tab=account", "/dashboard")).toBe(
      "/profile?tab=account",
    );
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "profile",
    "/profile\nlocation",
  ])("falls back instead of redirecting to an unsafe path: %s", (value) => {
    expect(safeNextPath(value, "/dashboard")).toBe("/dashboard");
  });
});
