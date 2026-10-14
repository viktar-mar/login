import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authConfig } from "@/config/auth";
import type { AuthActionState } from "@/features/auth/types";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { EmailForm, type EmailFormMode } from "./email-form";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "google,github",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});

const actions = vi.hoisted(() => ({
  loginAction: vi.fn(),
  signupAction: vi.fn(),
  forgotPasswordAction: vi.fn(),
  updatePasswordAction: vi.fn(),
}));

vi.mock("@/features/auth/actions", () => actions);

function renderForm(mode: EmailFormMode, locale: "en" | "ru" = "en") {
  return render(
    <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
      <EmailForm mode={mode} next="/projects?view=active" />
    </I18nProvider>,
  );
}

beforeEach(() => {
  Object.values(actions).forEach((action) => {
    action.mockReset();
    action.mockResolvedValue({ status: "idle" } satisfies AuthActionState);
  });
  (authConfig as { emailEnabled: boolean }).emailEnabled = true;
});

afterEach(() => {
  (authConfig as { emailEnabled: boolean }).emailEnabled = true;
});

describe("EmailForm modes", () => {
  it("renders login fields, actions, and a sanitized continuation", () => {
    renderForm("login");

    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fprojects%3Fview%3Dactive",
    );
    expect(screen.getByDisplayValue("/projects?view=active")).toHaveAttribute(
      "name",
      "next",
    );
  });

  it("renders signup password confirmation with new-password autocomplete", () => {
    renderForm("signup");

    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fprojects%3Fview%3Dactive",
    );
  });

  it("renders the forgot-password email field without a password", () => {
    renderForm("forgot");

    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send recovery link" }),
    ).toBeInTheDocument();
  });

  it("renders only new-password and confirmation fields for updates", () => {
    renderForm("update");

    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeInTheDocument();
  });
});

it("replaces an unsafe continuation with the configured post-login path", () => {
  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <EmailForm mode="login" next="//attacker.example/steal" />
    </I18nProvider>,
  );

  expect(screen.getByDisplayValue("/dashboard")).toHaveAttribute(
    "type",
    "hidden",
  );
});

it("retains only the email after a recoverable login failure", async () => {
  const user = userEvent.setup();
  actions.loginAction.mockResolvedValue({
    status: "error",
    code: "invalid_credentials",
  } satisfies AuthActionState);
  renderForm("login");

  const email = screen.getByLabelText("Email address");
  const password = screen.getByLabelText("Password");
  await user.type(email, "reader@example.com");
  await user.type(password, "correct-horse-battery-staple");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Incorrect email or password.",
  );
  expect(email).toHaveValue("reader@example.com");
  expect(password).toHaveValue("");
});

it("associates localized field errors with their inputs", async () => {
  const user = userEvent.setup();
  actions.signupAction.mockResolvedValue({
    status: "error",
    code: "unexpected",
    fieldErrors: {
      email: ["raw email error"],
      password: ["raw password error"],
      confirmPassword: ["raw confirmation error"],
    },
  } satisfies AuthActionState);
  renderForm("signup", "ru");

  await user.type(screen.getByLabelText("Адрес электронной почты"), "a@b.co");
  await user.type(screen.getByLabelText("Пароль"), "password");
  await user.type(screen.getByLabelText("Подтвердите пароль"), "password");
  await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));

  const emailError = await screen.findByText(
    "Введите корректный адрес электронной почты.",
  );
  const passwordError = screen.getByText(
    "Пароль должен содержать не менее 8 символов.",
  );
  const confirmationError = screen.getByText("Пароли не совпадают.");

  expect(screen.getByLabelText("Адрес электронной почты")).toHaveAttribute(
    "aria-describedby",
    emailError.id,
  );
  expect(screen.getByLabelText("Пароль")).toHaveAttribute(
    "aria-describedby",
    passwordError.id,
  );
  expect(screen.getByLabelText("Подтвердите пароль")).toHaveAttribute(
    "aria-describedby",
    confirmationError.id,
  );
  expect(screen.queryByText("raw email error")).not.toBeInTheDocument();
});

it("announces the same neutral recovery result regardless of account existence", async () => {
  const user = userEvent.setup();
  actions.forgotPasswordAction.mockResolvedValue({
    status: "success",
    code: "recovery_sent",
  } satisfies AuthActionState);
  renderForm("forgot");

  await user.type(screen.getByLabelText("Email address"), "nobody@example.com");
  await user.click(screen.getByRole("button", { name: "Send recovery link" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "If an account exists, a recovery link has been sent.",
  );
});

it("disables submission while the selected action is pending", async () => {
  let finish!: (state: AuthActionState) => void;
  actions.loginAction.mockImplementation(
    () =>
      new Promise<AuthActionState>((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  renderForm("login");

  await user.type(screen.getByLabelText("Email address"), "reader@example.com");
  await user.type(screen.getByLabelText("Password"), "password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled(),
  );
  finish({ status: "idle" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
  );
});

it("renders no email form when email authentication is disabled", () => {
  (authConfig as { emailEnabled: boolean }).emailEnabled = false;
  renderForm("login");

  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
});
