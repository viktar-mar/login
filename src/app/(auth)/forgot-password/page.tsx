import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { siteConfig } from "@/config/site";
import { EmailForm } from "@/features/auth/components/email-form";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary, getRequestLocale } from "@/i18n/server";

export const metadata: Metadata = {
  title: `Reset your password | ${siteConfig.name}`,
};

export default async function ForgotPasswordPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <AuthShell
        title={dictionary.passwordRecovery.title}
        description={dictionary.passwordRecovery.message}
      >
        <EmailForm mode="forgot" />
      </AuthShell>
    </I18nProvider>
  );
}
