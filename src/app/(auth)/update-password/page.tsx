import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { siteConfig } from "@/config/site";
import { AuthMessage } from "@/features/auth/components/auth-message";
import { EmailForm } from "@/features/auth/components/email-form";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";

export const metadata: Metadata = {
  title: `Set a new password | ${siteConfig.name}`,
};

export default async function UpdatePasswordPage() {
  const [identity, locale] = await Promise.all([
    getVerifiedIdentity(undefined, { requiredAuthMethod: "recovery" }),
    getRequestLocale(),
  ]);
  const dictionary = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <AuthShell title={dictionary.passwordUpdate.title}>
        {identity ? (
          <EmailForm mode="update" />
        ) : (
          <AuthMessage state={{ status: "error", code: "invalid_link" }} />
        )}
      </AuthShell>
    </I18nProvider>
  );
}
