import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { ThemeSwitcher } from "./theme-switcher";

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme, theme: "system" }),
}));

it("uses the localized label to change the active theme", async () => {
  const user = userEvent.setup();
  const dictionary = getDictionary("ru");

  render(
    <I18nProvider locale="ru" dictionary={dictionary}>
      <ThemeSwitcher />
    </I18nProvider>,
  );

  await user.selectOptions(
    screen.getByRole("combobox", { name: dictionary.theme.label }),
    "dark",
  );

  expect(setTheme).toHaveBeenCalledWith("dark");
});
