import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { AuthShell } from "./auth-shell";

it("identifies the authentication page and product branding", () => {
  render(
    <AuthShell title="Create your account">
      <p>Form content</p>
    </AuthShell>,
  );

  expect(
    screen.getByRole("heading", { name: "Create your account" }),
  ).toBeInTheDocument();
  expect(screen.getByAltText(siteConfig.name)).toBeInTheDocument();
});
