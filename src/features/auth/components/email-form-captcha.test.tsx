import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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

const boundary = vi.hoisted(() => ({
  script: vi.fn(),
  action: vi.fn(),
}));
vi.mock("next/script", () => ({
  default: (props: unknown) => {
    boundary.script(props);
    return null;
  },
}));
vi.mock("@/features/auth/actions", () => ({
  loginAction: boundary.action,
  signupAction: boundary.action,
  forgotPasswordAction: boundary.action,
  updatePasswordAction: boundary.action,
}));

type Challenge = {
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};
const renderChallenge =
  vi.fn<(container: HTMLElement, options: Challenge) => string>();
const removeChallenge = vi.fn();
function challenge() {
  return renderChallenge.mock.lastCall![1];
}
function ready() {
  Object.assign(window, {
    turnstile: { render: renderChallenge, remove: removeChallenge },
  });
  act(() => boundary.script.mock.lastCall![0].onReady());
}
function renderForm(mode: EmailFormMode = "login", locale: "en" | "ru" = "en") {
  return render(
    <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
      <EmailForm mode={mode} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  boundary.script.mockClear();
  boundary.action
    .mockReset()
    .mockResolvedValue({ status: "error", code: "captcha_failed" });
  renderChallenge
    .mockReset()
    .mockImplementation(() => `widget-${renderChallenge.mock.calls.length}`);
  removeChallenge.mockClear();
  Object.assign(window, { turnstile: undefined });
  authConfig.captcha = { provider: "turnstile", siteKey: "public-site-key" };
});
afterEach(() => {
  authConfig.captcha = { provider: "none", siteKey: "" };
  vi.useRealTimers();
});

it.each([
  ["login", "Sign in"],
  ["signup", "Create account"],
  ["forgot", "Send recovery link"],
] as const)("blocks %s until the challenge succeeds", (mode, label) => {
  renderForm(mode);
  const submit = screen.getByRole("button", { name: label });
  expect(submit).toBeDisabled();
  ready();
  act(() => challenge().callback("single-use-token"));
  expect(submit).toBeEnabled();
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).get(
      "captchaToken",
    ),
  ).toBe("single-use-token");
  expect(renderChallenge.mock.lastCall![1]).toMatchObject({
    size: "compact",
    "response-field": false,
    language: "en",
  });
});

it.each(["error-callback", "expired-callback", "timeout-callback"] as const)(
  "clears the token on %s and allows a fresh challenge",
  async (callback) => {
    const user = userEvent.setup();
    renderForm();
    ready();
    const oldChallenge = challenge();
    act(() => oldChallenge.callback("used-token"));
    act(() => oldChallenge[callback]());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).get(
        "captchaToken",
      ),
    ).toBe("");
    await user.click(
      screen.getByRole("button", { name: "Retry security check" }),
    );
    expect(removeChallenge).toHaveBeenCalledWith("widget-1");
    expect(renderChallenge).toHaveBeenCalledTimes(2);
    act(() => oldChallenge.callback("stale-token"));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    act(() => challenge().callback("fresh-token"));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  },
);

it("consumes the token after sending it and preserves only the email after an error", async () => {
  const user = userEvent.setup();
  renderForm();
  ready();
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password" },
  });
  act(() => challenge().callback("single-use-token"));
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(boundary.action).toHaveBeenCalledOnce());
  expect(boundary.action.mock.lastCall![1].get("captchaToken")).toBe(
    "single-use-token",
  );
  expect(
    await screen.findByText("Security check failed. Please try again."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Email address")).toHaveValue(
    "reader@example.com",
  );
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  expect(renderChallenge).toHaveBeenCalledTimes(2);
});

it("stays disabled if the external script cannot load, with a retry action", () => {
  renderForm();
  act(() => boundary.script.mock.lastCall![0].onError());
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  expect(
    screen.getByText("Security check failed. Please try again."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Retry security check" }),
  ).toBeEnabled();
});

it("offers retry when script loading hangs", () => {
  vi.useFakeTimers();
  renderForm();
  act(() => {
    vi.advanceTimersByTime(15000);
  });
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Retry security check" }),
  ).toBeEnabled();
});

it("cleans up on unmount and ignores late provider callbacks", () => {
  const view = renderForm();
  ready();
  const oldChallenge = challenge();
  view.unmount();
  expect(removeChallenge).toHaveBeenCalledWith("widget-1");
  act(() => oldChallenge.callback("late-token"));
  expect(boundary.action).not.toHaveBeenCalled();
});

it("localizes provider language and errors", () => {
  renderForm("forgot", "ru");
  ready();
  act(() => challenge()["expired-callback"]());
  expect(renderChallenge.mock.lastCall![1]).toMatchObject({ language: "ru" });
  expect(
    screen.getByText("Срок проверки истёк. Попробуйте ещё раз."),
  ).toBeInTheDocument();
});

it("does not load Cloudflare or require a token when disabled", () => {
  authConfig.captcha.provider = "none";
  renderForm();
  expect(boundary.script).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).has(
      "captchaToken",
    ),
  ).toBe(false);
});

it("does not challenge an already verified password-update flow", () => {
  renderForm("update");
  expect(boundary.script).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
});

it("keeps the form pending even if another token arrives during submission", async () => {
  let finish!: (value: { status: "idle" }) => void;
  boundary.action.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderForm();
  ready();
  act(() => challenge().callback("token"));
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(boundary.action).toHaveBeenCalledOnce());
  act(() => challenge().callback("another-token"));
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await act(async () => {
    finish({ status: "idle" });
  });
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
});
