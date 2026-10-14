import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { PasswordField } from "./password-field";

it("preserves native input attributes and toggles password visibility accessibly", async () => {
  const user = userEvent.setup();

  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <PasswordField
        id="account-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        minLength={8}
        required
      />
    </I18nProvider>,
  );

  const input = screen.getByLabelText("Password");
  const toggle = screen.getByRole("button", { name: "Show password" });

  expect(screen.queryByText("Show password")).not.toBeInTheDocument();
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("name", "password");
  expect(input).toHaveAttribute("autocomplete", "current-password");
  expect(input).toHaveAttribute("minlength", "8");
  expect(input).toBeRequired();
  expect(toggle).toHaveAttribute("aria-pressed", "false");

  await user.click(toggle);

  expect(input).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.queryByText("Hide password")).not.toBeInTheDocument();
});
