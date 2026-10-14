"use client";

import { useActionState } from "react";
import { signOutAction } from "@/features/auth/actions";
import { AuthMessage } from "@/features/auth/components/auth-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import type { AuthActionState } from "@/features/auth/types";
import { useDictionary } from "@/i18n/provider";

const initialState: AuthActionState = { status: "idle" };

export function LogoutButton() {
  const { dictionary } = useDictionary();
  const [state, formAction] = useActionState(signOutAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton variant="outline">
        {dictionary.navigation.signOut}
      </SubmitButton>
      <AuthMessage state={state} />
    </form>
  );
}
