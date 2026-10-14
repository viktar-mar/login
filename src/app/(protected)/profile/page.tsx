import { Card, CardContent } from "@/components/ui/card";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getOwnProfile } from "@/features/profile/server/queries";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import { requireUser } from "@/lib/auth/require-user";

export default async function ProfilePage() {
  const { supabase } = await requireUser("/profile");
  const profile = await getOwnProfile(supabase);
  const dictionary = getDictionary(await getRequestLocale());

  return (
    <main className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {dictionary.profile.title}
      </h1>
      <Card>
        <CardContent className="pt-6">
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </main>
  );
}
