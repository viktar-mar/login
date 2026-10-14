import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { authConfig } from "@/config/auth";
import { siteConfig } from "@/config/site";
import { EmailForm } from "@/features/auth/components/email-form";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { safeNextPath } from "@/lib/navigation/safe-next";

export const metadata: Metadata = {
  title: `Sign up | ${siteConfig.name}`,
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [{ next }, identity, locale] = await Promise.all([
    searchParams,
    getVerifiedIdentity(),
    getRequestLocale(),
  ]);
  const continuation = safeNextPath(
    typeof next === "string" ? next : undefined,
    siteConfig.afterLoginPath,
  );

  if (identity) {
    redirect(continuation);
  }

  const dictionary = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <AuthShell title={dictionary.signup.title}>
        <div className="space-y-5">
          <OAuthButtons
            providers={authConfig.providers}
            emailEnabled={authConfig.emailEnabled}
            next={continuation}
          />
          <EmailForm mode="signup" next={continuation} />
        </div>
      </AuthShell>
    </I18nProvider>
  );
}
