import Link from "next/link";
import { LogoutButton } from "@/features/profile/components/logout-button";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import { requireUser } from "@/lib/auth/require-user";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const dictionary = getDictionary(await getRequestLocale());

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6">
      <nav className="border-border mb-8 flex flex-wrap items-center gap-5 border-b pb-5">
        <Link
          className="font-medium underline-offset-4 hover:underline"
          href="/dashboard"
        >
          {dictionary.navigation.dashboard}
        </Link>
        <Link
          className="font-medium underline-offset-4 hover:underline"
          href="/profile"
        >
          {dictionary.navigation.profile}
        </Link>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
      {children}
    </div>
  );
}
