import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import HomePage from "./page";

vi.mock("@/config/site", async (importOriginal) => {
  const { siteConfig } = await importOriginal<typeof import("@/config/site")>();

  return {
    siteConfig: {
      ...siteConfig,
      name: "Harbor Desk",
      logo: "/harbor-desk.svg",
    },
  };
});

it("offers entry to the authentication flow", () => {
  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <HomePage />
    </I18nProvider>,
  );

  expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
});

it("uses the configured product name for home branding", () => {
  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <HomePage />
    </I18nProvider>,
  );

  expect(screen.getByText("Harbor Desk")).toBeInTheDocument();
});

it("uses the configured logo with the product name as its accessible label", () => {
  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <HomePage />
    </I18nProvider>,
  );

  expect(screen.getByRole("img", { name: "Harbor Desk" })).toHaveAttribute(
    "src",
    "/harbor-desk.svg",
  );
});
