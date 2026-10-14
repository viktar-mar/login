import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { AuthActionState } from "@/features/auth/types";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { OAuthButtons } from "./oauth-buttons";

const actions = vi.hoisted(() => ({
  oauthAction: vi.fn(),
}));

vi.mock("@/features/auth/actions", () => actions);

function renderButtons(
  providers: Array<"google" | "azure" | "discord">,
  emailEnabled = true,
) {
  return render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <OAuthButtons
        providers={providers}
        emailEnabled={emailEnabled}
        next="/projects?view=active"
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  actions.oauthAction.mockReset();
  actions.oauthAction.mockResolvedValue({
    status: "idle",
  } satisfies AuthActionState);
});

it("renders configured providers in order with localized labels and form values", () => {
  renderButtons(["google", "azure", "discord"]);

  const buttons = screen.getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual([
    "Continue with Google",
    "Continue with Microsoft",
    "Continue with Discord",
  ]);

  const forms = buttons.map((button) => button.closest("form"));
  expect(
    forms.map((form) =>
      within(form as HTMLFormElement)
        .getByDisplayValue(/google|azure|discord/)
        .getAttribute("name"),
    ),
  ).toEqual(["provider", "provider", "provider"]);
  expect(
    forms.map((form) =>
      within(form as HTMLFormElement)
        .getByDisplayValue(/google|azure|discord/)
        .getAttribute("value"),
    ),
  ).toEqual(["google", "azure", "discord"]);
  expect(screen.getAllByDisplayValue("/projects?view=active")).toHaveLength(3);
  expect(screen.getByRole("separator")).toBeInTheDocument();
});

it("renders no divider when no social providers are configured", () => {
  renderButtons([]);

  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("separator")).not.toBeInTheDocument();
});

it("disables every provider while the selected OAuth action is pending", async () => {
  let finish!: (state: AuthActionState) => void;
  actions.oauthAction.mockImplementation(
    () =>
      new Promise<AuthActionState>((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  renderButtons(["google", "azure", "discord"]);

  await user.click(
    screen.getByRole("button", { name: "Continue with Google" }),
  );

  expect(actions.oauthAction).toHaveBeenCalledOnce();
  const submitted = actions.oauthAction.mock.calls[0]?.[1] as FormData;
  expect(Object.fromEntries(submitted.entries())).toEqual({
    provider: "google",
    next: "/projects?view=active",
  });
  await waitFor(() =>
    expect(
      screen
        .getAllByRole<HTMLButtonElement>("button")
        .every((button) => button.disabled),
    ).toBe(true),
  );

  finish({ status: "idle" });
  await waitFor(() =>
    expect(
      screen
        .getAllByRole<HTMLButtonElement>("button")
        .every((button) => !button.disabled),
    ).toBe(true),
  );
});
