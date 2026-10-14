import { expect, it } from "vitest";
import { cn } from "./cn";

it("keeps the last conflicting Tailwind utility", () => {
  expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4");
});
