import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";

describe("profileSchema", () => {
  it.each(["", "   ", "x".repeat(101)])(
    "rejects an empty or oversized display name",
    (displayName) => {
      expect(
        profileSchema.safeParse({ displayName, avatarUrl: "" }).success,
      ).toBe(false);
    },
  );

  it("trims display names and permits the 100-character boundary", () => {
    expect(
      profileSchema.parse({
        displayName: ` ${"x".repeat(100)} `,
        avatarUrl: "",
      }),
    ).toEqual({ displayName: "x".repeat(100), avatarUrl: null });
  });

  it.each(["https://example.com/avatar.png", "http://example.com/avatar.png"])(
    "accepts HTTP avatar URL %s",
    (avatarUrl) => {
      expect(
        profileSchema.parse({ displayName: "Reader", avatarUrl }).avatarUrl,
      ).toBe(avatarUrl);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "ftp://example.com/avatar",
    "//example.com/avatar",
    "/avatar.png",
    "broken",
  ])("rejects non-HTTP avatar URL %s", (avatarUrl) => {
    expect(
      profileSchema.safeParse({ displayName: "Reader", avatarUrl }).success,
    ).toBe(false);
  });

  it("allows an omitted avatar and strips identity fields", () => {
    expect(
      profileSchema.parse({
        displayName: " Reader ",
        userId: "other-user",
        id: "other-user",
      }),
    ).toEqual({ displayName: "Reader", avatarUrl: null });
  });
});
