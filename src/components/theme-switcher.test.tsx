import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { ThemeSwitcher } from "./theme-switcher";

const { setTheme, savedTheme } = vi.hoisted(() => ({
  setTheme: vi.fn(),
  savedTheme: { value: "system" as string | undefined },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme, theme: savedTheme.value }),
}));

beforeEach(() => {
  savedTheme.value = "system";
  setTheme.mockClear();
});

function switcher() {
  return (
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <ThemeSwitcher />
    </I18nProvider>
  );
}

it("keeps the unknown server theme inactive until hydration", () => {
  savedTheme.value = undefined;
  const container = document.createElement("div");
  container.innerHTML = renderToString(switcher());

  const select = within(container).getByRole("combobox", { name: "Theme" });
  expect(select).toBeDisabled();
  expect(select).toHaveValue("");
});

it.each(["dark", "light", "system"])(
  "shows the saved %s selection after hydrating server HTML",
  async (theme) => {
    savedTheme.value = undefined;
    const container = document.createElement("div");
    container.innerHTML = renderToString(switcher());
    document.body.append(container);
    const onRecoverableError = vi.fn();
    let root: Root | undefined;

    try {
      savedTheme.value = theme;
      await act(async () => {
        root = hydrateRoot(container, switcher(), { onRecoverableError });
      });

      const select = within(container).getByRole("combobox", { name: "Theme" });
      expect(select).toHaveValue(theme);
      expect(select).toBeEnabled();
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  },
);

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
