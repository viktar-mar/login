import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/server";
import { ProfileForm } from "./profile-form";

const update = vi.hoisted(() => vi.fn());
vi.mock("@/features/profile/actions", () => ({ updateProfileAction: update }));
const profile = {
  id: "verified-user",
  display_name: "Reader",
  avatar_url: "https://example.com/avatar.png",
  created_at: "2026-09-12T12:00:00Z",
  updated_at: "2026-09-12T12:00:00Z",
};

function renderForm(locale: "en" | "ru" = "en") {
  return render(
    <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
      <ProfileForm profile={profile} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue({ status: "success" });
});

it("renders current editable profile values without editable identity", () => {
  const { container } = renderForm();
  expect(screen.getByLabelText("Display name")).toHaveValue("Reader");
  expect(screen.getByLabelText("Avatar URL")).toHaveValue(
    "https://example.com/avatar.png",
  );
  expect(container.querySelector('[name="id"], [name="userId"]')).toBeNull();
});

it("submits changed values and announces successful persistence", async () => {
  const user = userEvent.setup();
  renderForm();
  await user.clear(screen.getByLabelText("Display name"));
  await user.type(screen.getByLabelText("Display name"), "New reader");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Profile updated.",
  );
  const submitted = update.mock.calls[0][1] as FormData;
  expect(submitted.get("displayName")).toBe("New reader");
  expect(submitted.get("avatarUrl")).toBe("https://example.com/avatar.png");
});

it("associates Russian validation messages with their inputs and retains entered values", async () => {
  const user = userEvent.setup();
  update.mockResolvedValue({
    status: "error",
    code: "validation",
    fieldErrors: { displayName: ["required"], avatarUrl: ["invalid_url"] },
  });
  renderForm("ru");
  await user.click(screen.getByRole("button", { name: "Сохранить изменения" }));
  const nameError = await screen.findByText("Введите отображаемое имя.");
  const avatarError = screen.getByText("Введите корректный URL аватара.");
  expect(screen.getByLabelText("Отображаемое имя")).toHaveAttribute(
    "aria-describedby",
    nameError.id,
  );
  expect(screen.getByLabelText("URL аватара")).toHaveAttribute(
    "aria-describedby",
    avatarError.id,
  );
  expect(screen.getByLabelText("Отображаемое имя")).toHaveValue("Reader");
  expect(screen.getByLabelText("URL аватара")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("localizes oversized display names", async () => {
  const user = userEvent.setup();
  update.mockResolvedValue({
    status: "error",
    code: "validation",
    fieldErrors: { displayName: ["too_long"] },
  });
  renderForm();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    await screen.findByText("Display name is too long."),
  ).toBeInTheDocument();
});

it.each([
  [
    "en",
    "Display name",
    "Save changes",
    "Review the highlighted fields and try again.",
  ],
  [
    "ru",
    "Отображаемое имя",
    "Сохранить изменения",
    "Проверьте выделенные поля и попробуйте ещё раз.",
  ],
] as const)(
  "announces server validation failures in %s",
  async (locale, nameLabel, submitLabel, summary) => {
    const user = userEvent.setup();
    update.mockResolvedValue({
      status: "error",
      code: "validation",
      fieldErrors: { displayName: ["required"] },
    });
    renderForm(locale);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(nameLabel));
    await user.type(screen.getByLabelText(nameLabel), "   ");
    await user.click(screen.getByRole("button", { name: submitLabel }));

    expect(await screen.findByRole("alert")).toHaveTextContent(summary);
    expect(screen.getByLabelText(nameLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
);

it("offers sign-in after the session expires", async () => {
  const user = userEvent.setup();
  update.mockResolvedValue({ status: "error", code: "unauthorized" });
  renderForm();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please sign in to continue.",
  );
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?next=%2Fprofile",
  );
});

it("disables saving while a profile update is pending", async () => {
  let finish!: (state: { status: "success" }) => void;
  update.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  renderForm();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled(),
  );
  finish({ status: "success" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled(),
  );
});
