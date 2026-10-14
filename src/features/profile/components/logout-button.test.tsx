import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { LogoutButton } from "./logout-button";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/actions", () => ({ signOutAction: signOut }));

it("invokes the existing sign-out action and displays recoverable failures", async () => {
  signOut.mockResolvedValue({ status: "error", code: "unexpected" });
  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <LogoutButton />
    </I18nProvider>,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Sign out" }));
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Something went wrong. Please try again.",
  );
});
