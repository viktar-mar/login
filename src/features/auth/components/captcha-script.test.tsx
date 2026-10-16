import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { authConfig } from "@/config/auth";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { EmailForm, type EmailFormMode } from "./email-form";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});
vi.mock("@/features/auth/actions", () => ({
  loginAction: vi.fn(),
  signupAction: vi.fn(),
  forgotPasswordAction: vi.fn(),
  updatePasswordAction: vi.fn(),
}));
afterEach(() => {
  authConfig.captcha = { provider: "none", siteKey: "" };
});

function renderForm(mode: EmailFormMode) {
  return render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <EmailForm mode={mode} />
    </I18nProvider>,
  );
}

it("initializes the new form when navigation happens during the real Next Script load", async () => {
  authConfig.captcha = { provider: "turnstile", siteKey: "public-key" };
  const renderChallenge = vi.fn(() => "new-widget");
  Object.assign(window, { turnstile: undefined });
  const first = renderForm("login");
  await waitFor(() =>
    expect(document.getElementById("cloudflare-turnstile")).toBeInTheDocument(),
  );
  const script = document.getElementById("cloudflare-turnstile")!;
  first.unmount();
  const second = renderForm("forgot");
  expect(
    screen.getByRole("button", { name: "Send recovery link" }),
  ).toBeDisabled();
  second.unmount();
  const third = renderForm("signup");
  expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  Object.assign(window, {
    turnstile: { render: renderChallenge, remove: vi.fn() },
  });
  fireEvent.load(script);
  await waitFor(() => expect(renderChallenge).toHaveBeenCalledOnce());
  third.unmount();
  // The same cached script must also initialize a later SPA mount without a new load.
  renderForm("login");
  await waitFor(() => expect(renderChallenge).toHaveBeenCalledTimes(2));
});
