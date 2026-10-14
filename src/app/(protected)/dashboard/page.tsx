import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import { requireUser } from "@/lib/auth/require-user";

export default async function DashboardPage() {
  const { userId, email } = await requireUser("/dashboard");
  const dictionary = getDictionary(await getRequestLocale());

  return (
    <main className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {dictionary.dashboard.title}
      </h1>
      <Card>
        <CardHeader>
          <h2 className="text-xl font-medium">
            {dictionary.dashboard.welcome}
          </h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="space-y-4">
            {email ? (
              <div>
                <dt className="text-muted-foreground text-sm">
                  {dictionary.dashboard.signedInAs}
                </dt>
                <dd className="break-all">{email}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground text-sm">
                {dictionary.dashboard.userId}
              </dt>
              <dd className="font-mono text-sm break-all">{userId}</dd>
            </div>
          </dl>
          <Link
            className="inline-block font-medium underline underline-offset-4"
            href="/profile"
          >
            {dictionary.navigation.profile}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
