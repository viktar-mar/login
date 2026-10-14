import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import ProtectedLayout from "./layout";
import DashboardPage from "./dashboard/page";
import ProfilePage from "./profile/page";

const boundary = vi.hoisted(() => ({
  createClient: vi.fn(),
  claims: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: boundary.createClient,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/server")>()),
  getRequestLocale: async () => "en",
}));
vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/features/profile/actions", () => ({ updateProfileAction: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  boundary.createClient.mockResolvedValue({
    auth: { getClaims: boundary.claims },
    from: boundary.from,
  });
  boundary.claims.mockResolvedValue({
    data: {
      claims: {
        sub: "verified-user",
        email: "reader@example.com",
        access_token: "secret-token",
        role: "authenticated",
      },
    },
    error: null,
  });
});

describe("protected account routes", () => {
  it("does not render children after an anonymous layout redirect", async () => {
    boundary.claims.mockResolvedValue({ data: null, error: null });
    const renderChild = vi.fn();
    function PrivateChild() {
      renderChild();
      return <p>Private content</p>;
    }
    await expect(
      ProtectedLayout({ children: <PrivateChild /> }).then((view) =>
        render(view),
      ),
    ).rejects.toThrow("redirect:/login?next=%2Fdashboard");
    expect(renderChild).not.toHaveBeenCalled();
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("renders protected navigation and authorized children", async () => {
    render(
      <I18nProvider locale="en" dictionary={getDictionary("en")}>
        {await ProtectedLayout({ children: <p>Private content</p> })}
      </I18nProvider>,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Private content")).toBeInTheDocument();
  });

  it("shows verified email and ID on the dashboard without raw claims or tokens", async () => {
    render(await DashboardPage());
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();
    expect(screen.getByText("verified-user")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      screen.queryByText(/secret-token|authenticated/),
    ).not.toBeInTheDocument();
  });

  it("checks identity before reading profile data and preserves the profile continuation", async () => {
    boundary.claims.mockResolvedValue({ data: null, error: null });
    await expect(ProfilePage()).rejects.toThrow(
      "redirect:/login?next=%2Fprofile",
    );
    expect(boundary.from).not.toHaveBeenCalled();
  });
});
