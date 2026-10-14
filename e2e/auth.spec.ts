import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";

test("home and auth buttons inherit a customized palette in both themes", async ({
  page,
}) => {
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await page.addStyleTag({
      content:
        ":root { --primary: #0f766e; --primary-foreground: #ffffff; } .dark { --primary: #5eead4; --primary-foreground: #042f2e; }",
    });
    const control =
      path === "/"
        ? page.getByRole("link", { name: "Sign in", exact: true })
        : page.getByRole("button", { name: "Sign in", exact: true });
    const theme = page.getByRole("combobox", { name: "Theme" });
    await theme.selectOption("light");
    await expect(control).toHaveCSS("background-color", "rgb(15, 118, 110)");
    await expect(control).toHaveCSS("color", "rgb(255, 255, 255)");
    await theme.selectOption("dark");
    await expect(control).toHaveCSS("background-color", "rgb(94, 234, 212)");
    await expect(control).toHaveCSS("color", "rgb(4, 47, 46)");
  }
});

for (const path of ["/dashboard", "/profile", "/update-password"]) {
  test(`an anonymous ${path} visit preserves the requested destination`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(
      `http://localhost:3000/login?next=${encodeURIComponent(path)}`,
    );
    await expect(
      page.getByRole("form", { name: "Authentication" }),
    ).toBeVisible();
  });
}

for (const form of [
  { path: "/login", submit: "Sign in", password: true, confirmation: false },
  {
    path: "/signup",
    submit: "Create account",
    password: true,
    confirmation: true,
  },
  {
    path: "/forgot-password",
    submit: "Send recovery link",
    password: false,
    confirmation: false,
  },
]) {
  test(`${form.path} exposes its accessible email form`, async ({ page }) => {
    await page.goto(form.path);
    const authForm = page.getByRole("form", { name: "Authentication" });
    await expect(authForm).toBeVisible();
    await expect(
      authForm.getByLabel("Email address", { exact: true }),
    ).toBeVisible();
    await expect(authForm.getByLabel("Password", { exact: true })).toHaveCount(
      form.password ? 1 : 0,
    );
    await expect(
      authForm.getByLabel("Confirm password", { exact: true }),
    ).toHaveCount(form.confirmation ? 1 : 0);
    await expect(
      authForm.getByRole("button", { name: form.submit, exact: true }),
    ).toBeVisible();
  });
}

test("email forms fit a 320px viewport without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });

  for (const path of ["/login", "/signup", "/forgot-password"]) {
    await page.goto(path);
    const authForm = page.getByRole("form", { name: "Authentication" });
    await expect(authForm).toBeVisible();
    await expect(
      authForm.getByLabel("Email address", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        })),
      )
      .toEqual({ content: 320, viewport: 320 });
  }
});

test("the selected locale survives navigation and reload", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("combobox", { name: "Language" }).selectOption("ru");
  await expect(
    page.getByRole("heading", { name: "Войти", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Создайте аккаунт" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Язык" })).toHaveValue("ru");
  await expect(
    page.getByLabel("Адрес электронной почты", { exact: true }),
  ).toBeVisible();
});

test("theme selection changes the rendered theme and survives reload", async ({
  page,
}) => {
  await page.goto("/login");
  const theme = page.getByRole("combobox", { name: "Theme" });
  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(theme).toHaveValue("dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await theme.selectOption("light");
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
});

test("social buttons follow configured order on login and signup", async ({
  page,
}) => {
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: /^Continue with / }),
    ).toHaveText([
      "Continue with GitHub",
      "Continue with Google",
      "Continue with Microsoft",
    ]);
  }
});

test("failed auth callbacks and confirmation links show a safe login alert", async ({
  page,
}) => {
  for (const path of [
    "/auth/callback?error=access_denied&error_description=provider-private-detail",
    "/auth/confirm?type=email&token_hash=invalid-test-token&error_description=provider-private-detail",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      "http://localhost:3000/login?error=invalid_link",
    );
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toHaveText(
      "This authentication link is invalid or has expired. Please try again.",
    );
    await expect(alert).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "provider-private-detail",
    );
    await expect(page.locator("body")).not.toContainText("invalid-test-token");
  }
});

async function latestConfirmationLink(
  request: APIRequestContext,
  email: string,
  type: "email" | "recovery",
  previousLink?: string,
) {
  const query = encodeURIComponent(`to:"${email}"`);
  const messageUrl = `http://127.0.0.1:54324/view/latest.html?query=${query}`;
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const response = await request.get(messageUrl, {
      timeout: Math.max(1, deadline - Date.now()),
    });
    if (response.ok()) {
      const html = await response.text();
      for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
        const href = match[1].replaceAll("&amp;", "&");
        let url: URL;
        try {
          url = new URL(href);
        } catch {
          continue;
        }
        const isSignup =
          type === "email" &&
          url.origin === "http://localhost:3000" &&
          url.pathname === "/auth/confirm" &&
          url.searchParams.get("type") === "email" &&
          Boolean(url.searchParams.get("token_hash"));
        const isRecovery =
          type === "recovery" &&
          url.origin === "http://127.0.0.1:54321" &&
          url.pathname === "/auth/v1/verify" &&
          url.searchParams.get("type") === "recovery" &&
          Boolean(url.searchParams.get("token")) &&
          url.searchParams.get("redirect_to") ===
            "http://localhost:3000/auth/callback?next=%2Fupdate-password";
        if (
          !url.username &&
          !url.password &&
          !url.hash &&
          (isSignup || isRecovery) &&
          url.href !== previousLink
        ) {
          return url.href;
        }
      }
    }
    await setTimeout(Math.min(250, Math.max(0, deadline - Date.now())));
  }

  throw new Error(
    `Mailpit did not deliver a new local ${type} confirmation link within 10 seconds.`,
  );
}

test("local email signup, profile persistence, logout, login and password recovery", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const email = `browser-${randomUUID()}@example.test`;
  const password = randomUUID();
  const newPassword = randomUUID();

  await page.goto("/signup");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Check your email to confirm your account.",
  );

  const confirmationLink = await latestConfirmationLink(
    request,
    email,
    "email",
  );
  await page.goto(confirmationLink);
  await expect(page).toHaveURL("http://localhost:3000/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Profile", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3000/profile");
  await page.getByLabel("Display name", { exact: true }).fill("Browser Tester");
  await page
    .getByLabel("Avatar URL", { exact: true })
    .fill("https://example.test/avatar.png");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profile updated.");
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Browser Tester",
  );
  await expect(page.getByLabel("Avatar URL", { exact: true })).toHaveValue(
    "https://example.test/avatar.png",
  );

  await page.goto("/update-password");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "This recovery link is invalid or has expired.",
  );
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page.goto("/profile");

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("http://localhost:3000/login?next=%2Fdashboard");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/dashboard");

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/login");
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3000/forgot-password");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send recovery link", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "If an account exists, a recovery link has been sent.",
  );

  const recoveryLink = await latestConfirmationLink(
    request,
    email,
    "recovery",
    confirmationLink,
  );
  await page.goto(recoveryLink);
  await expect(page).toHaveURL("http://localhost:3000/update-password");
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3000/login");
  await expect(
    page.getByRole("form", { name: "Authentication" }),
  ).toBeVisible();

  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("form", { name: "Authentication" }).getByRole("alert"),
  ).toHaveText("Incorrect email or password.");
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/dashboard");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});
