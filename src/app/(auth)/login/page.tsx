import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authConfig } from "@/config/auth";
import { siteConfig } from "@/config/site";
import { EmailForm } from "@/features/auth/components/email-form";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { safeNextPath } from "@/lib/navigation/safe-next";

export const metadata: Metadata = {
  title: `Sign in | ${siteConfig.name}`,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const [{ next, error }, identity, locale] = await Promise.all([
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
      <AuthShell title={dictionary.auth.signIn}>
        <div className="space-y-5">
          {error === "invalid_link" && (
            <Alert variant="destructive">
              <AlertDescription>
                {dictionary.errors.authLinkInvalid}
              </AlertDescription>
            </Alert>
          )}
          <OAuthButtons
            providers={authConfig.providers}
            emailEnabled={authConfig.emailEnabled}
            next={continuation}
          />
          <EmailForm mode="login" next={continuation} />
        </div>
      </AuthShell>
    </I18nProvider>
  );
}
