import { render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ru } from "@/i18n/dictionaries/ru";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "google,github",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});

const dependencies = vi.hoisted(() => ({
  getVerifiedIdentity: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
  getRequestLocale: vi.fn().mockResolvedValue("en"),
  getDictionary: vi.fn(),
}));

vi.mock("@/lib/auth/verified-identity", () => ({
  getVerifiedIdentity: dependencies.getVerifiedIdentity,
}));

vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));

vi.mock("@/i18n/server", () => ({
  getRequestLocale: dependencies.getRequestLocale,
  getDictionary: dependencies.getDictionary,
}));

let LoginPage: typeof import("./login/page").default;
let SignupPage: typeof import("./signup/page").default;
let ForgotPasswordPage: typeof import("./forgot-password/page").default;
let UpdatePasswordPage: typeof import("./update-password/page").default;

beforeAll(async () => {
  [LoginPage, SignupPage, ForgotPasswordPage, UpdatePasswordPage] =
    await Promise.all([
      import("./login/page").then((module) => module.default),
      import("./signup/page").then((module) => module.default),
      import("./forgot-password/page").then((module) => module.default),
      import("./update-password/page").then((module) => module.default),
    ]);
});

beforeEach(() => {
  dependencies.getVerifiedIdentity.mockReset();
  dependencies.getVerifiedIdentity.mockResolvedValue(null);
  dependencies.redirect.mockClear();
  dependencies.getRequestLocale.mockReset();
  dependencies.getRequestLocale.mockResolvedValue("en");
  dependencies.getDictionary.mockReset();
  dependencies.getDictionary.mockReturnValue(en);
});

describe("authentication pages", () => {
  it("renders the localized login form for an anonymous visitor", async () => {
    render(
      await LoginPage({ searchParams: Promise.resolve({ next: "/projects" }) }),
    );

    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("form", { name: "Authentication" }),
      ).getByDisplayValue("/projects"),
    ).toHaveAttribute("name", "next");
    expect(dependencies.getRequestLocale).toHaveBeenCalledOnce();
    expect(dependencies.getDictionary).toHaveBeenCalledWith("en");
  });

  it.each([
    [
      "en",
      en,
      "This authentication link is invalid or has expired. Please try again.",
    ],
    [
      "ru",
      ru,
      "Эта ссылка для входа или подтверждения недействительна или устарела. Попробуйте ещё раз.",
    ],
  ] as const)(
    "announces a generic invalid-link error on the %s login page",
    async (locale, dictionary, message) => {
      dependencies.getRequestLocale.mockResolvedValue(locale);
      dependencies.getDictionary.mockReturnValue(dictionary);

      render(
        await LoginPage({
          searchParams: Promise.resolve({ error: "invalid_link" }),
        }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(dependencies.getDictionary).toHaveBeenCalledWith(locale);
      expect(
        screen.getByRole("heading", { name: dictionary.auth.signIn }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    undefined,
    "",
    "unexpected",
    "provider-private-detail<script>alert(1)</script>",
    ["invalid_link", "provider-private-detail"],
  ])("ignores unallowlisted login error input %j", async (error) => {
    render(await LoginPage({ searchParams: Promise.resolve({ error }) }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/provider-private-detail/),
    ).not.toBeInTheDocument();
  });

  it("redirects an authenticated login visitor only to a safe continuation", async () => {
    dependencies.getVerifiedIdentity.mockResolvedValue({ userId: "user-1" });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({ next: "//attacker.example/steal" }),
      }),
    ).rejects.toThrow("redirect:/dashboard");
    expect(dependencies.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects an authenticated signup visitor to a valid continuation", async () => {
    dependencies.getVerifiedIdentity.mockResolvedValue({ userId: "user-1" });

    await expect(
      SignupPage({ searchParams: Promise.resolve({ next: "/projects" }) }),
    ).rejects.toThrow("redirect:/projects");
    expect(dependencies.redirect).toHaveBeenCalledWith("/projects");
  });

  it("renders signup and forgot-password pages for anonymous visitors", async () => {
    const { unmount } = render(
      await SignupPage({ searchParams: Promise.resolve({}) }),
    );
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
    unmount();

    render(await ForgotPasswordPage());
    expect(
      screen.getByRole("heading", { name: "Reset your password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send recovery link" }),
    ).toBeInTheDocument();
  });

  it("renders configured social authentication on login and signup", async () => {
    const { unmount } = render(
      await LoginPage({ searchParams: Promise.resolve({ next: "/projects" }) }),
    );
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeInTheDocument();
    unmount();

    render(
      await SignupPage({
        searchParams: Promise.resolve({ next: "/projects" }),
      }),
    );
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeInTheDocument();
  });

  it("renders the update form only with a verified recovery claim", async () => {
    dependencies.getVerifiedIdentity.mockResolvedValue({ userId: "user-1" });
    const { unmount } = render(await UpdatePasswordPage());
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeInTheDocument();
    expect(dependencies.getVerifiedIdentity).toHaveBeenCalledWith(undefined, {
      requiredAuthMethod: "recovery",
    });
    unmount();

    dependencies.getVerifiedIdentity.mockResolvedValue(null);
    render(await UpdatePasswordPage());
    expect(
      screen.queryByRole("button", { name: "Update password" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This recovery link is invalid or has expired.",
    );
  });
});
