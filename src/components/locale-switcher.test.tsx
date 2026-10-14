import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import { LocaleSwitcher } from "./locale-switcher";

const { refresh, setLocaleAction, enabledLocales } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setLocaleAction: vi.fn().mockResolvedValue(undefined),
  enabledLocales: ["en", "ru"],
}));

vi.mock("@/config/site", () => ({
  siteConfig: { locales: enabledLocales },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/i18n/actions", () => ({ setLocaleAction }));

beforeEach(() => {
  refresh.mockClear();
  setLocaleAction.mockClear();
  enabledLocales.splice(0, enabledLocales.length, "en", "ru");
});

it("only offers enabled languages", () => {
  enabledLocales.splice(0, enabledLocales.length, "en");

  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <LocaleSwitcher />
    </I18nProvider>,
  );

  expect(
    screen.getAllByRole("option").map((option) => option.getAttribute("value")),
  ).toEqual(["en"]);
});

it("offers a third enabled language without editing every dictionary", async () => {
  enabledLocales.splice(0, enabledLocales.length, "fr", "en");
  const user = userEvent.setup();

  render(
    <I18nProvider locale="en" dictionary={getDictionary("en")}>
      <LocaleSwitcher />
    </I18nProvider>,
  );

  expect(
    screen.getAllByRole("option").map((option) => option.getAttribute("value")),
  ).toEqual(["fr", "en"]);
  await user.selectOptions(screen.getByRole("combobox"), "fr");
  await waitFor(() => expect(setLocaleAction).toHaveBeenCalledWith("fr"));
});

it("keeps the localized language label visually available", () => {
  const dictionary = getDictionary("en");

  render(
    <I18nProvider locale="en" dictionary={dictionary}>
      <LocaleSwitcher />
    </I18nProvider>,
  );

  expect(screen.getByText(dictionary.locale.label)).not.toHaveClass("sr-only");
});

it("persists an English selection and refreshes the current route", async () => {
  const user = userEvent.setup();

  render(
    <I18nProvider locale="ru" dictionary={getDictionary("ru")}>
      <LocaleSwitcher />
    </I18nProvider>,
  );

  await user.selectOptions(screen.getByRole("combobox"), "en");

  await waitFor(() => {
    expect(setLocaleAction).toHaveBeenCalledWith("en");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
