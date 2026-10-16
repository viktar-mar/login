import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestLocale } from "@/i18n/server";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import LoginPage from "./page";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});

vi.mock("@/lib/auth/verified-identity", () => ({
  getVerifiedIdentity: vi.fn(),
}));
vi.mock("@/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/server")>()),
  getRequestLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`Redirect: ${path}`);
  }),
}));
vi.mock("@/features/auth/actions", () => ({
  loginAction: vi.fn(),
  signupAction: vi.fn(),
  forgotPasswordAction: vi.fn(),
  updatePasswordAction: vi.fn(),
  oauthAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getVerifiedIdentity).mockResolvedValue(null);
  vi.mocked(getRequestLocale).mockResolvedValue("en");
});

describe("LoginPage email confirmation", () => {
  it.each([
    ["en", "Your email has been confirmed. Sign in with your password."],
    ["ru", "Почта подтверждена. Войдите с вашим паролем."],
  ] as const)(
    "shows a localized confirmation and a sign-in form in %s",
    async (locale, message) => {
      vi.mocked(getRequestLocale).mockResolvedValue(locale);
      render(
        await LoginPage({
          searchParams: Promise.resolve({ confirmed: "email" }),
        }),
      );

      expect(screen.getByRole("status")).toHaveTextContent(message);
      expect(screen.getByRole("form")).toBeInTheDocument();
      expect(
        screen.getByLabelText(locale === "en" ? "Password" : "Пароль"),
      ).toBeInTheDocument();
    },
  );

  it.each([undefined, "unexpected", ["email", "email"]])(
    "does not treat %j as a valid confirmation notice",
    async (confirmed) => {
      render(await LoginPage({ searchParams: Promise.resolve({ confirmed }) }));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it("keeps an existing signed-in identity instead of using the confirmation notice as authentication", async () => {
    vi.mocked(getVerifiedIdentity).mockResolvedValue({
      userId: "existing-user",
    });
    await expect(
      LoginPage({ searchParams: Promise.resolve({ confirmed: "email" }) }),
    ).rejects.toThrow("Redirect: /dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
