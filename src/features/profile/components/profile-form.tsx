"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { updateProfileAction } from "@/features/profile/actions";
import type { Profile, ProfileActionState } from "@/features/profile/types";
import { useDictionary } from "@/i18n/provider";

const initialState: ProfileActionState = { status: "idle" };

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const { dictionary } = useDictionary();
  const baseId = useId();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const nameError = errors?.displayName
    ? errors.displayName.includes("too_long")
      ? dictionary.validation.displayNameTooLong
      : dictionary.validation.displayNameRequired
    : undefined;
  const avatarError = errors?.avatarUrl
    ? dictionary.validation.avatarUrlInvalid
    : undefined;
  const nameId = `${baseId}-name`;
  const avatarId = `${baseId}-avatar`;

  return (
    <form
      action={formAction}
      className="space-y-5"
      aria-label={dictionary.profile.title}
    >
      {state.status === "success" ? (
        <Alert role="status">{dictionary.profile.saved}</Alert>
      ) : null}
      {state.status === "error" ? (
        <Alert variant="destructive">
          {state.code === "unauthorized" ? (
            <>
              <p>{dictionary.errors.unauthorized}</p>
              <Link
                className="underline underline-offset-4"
                href="/login?next=%2Fprofile"
              >
                {dictionary.auth.signIn}
              </Link>
            </>
          ) : state.code === "validation" ? (
            dictionary.validation.reviewFields
          ) : (
            dictionary.errors.generic
          )}
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={nameId}>{dictionary.profile.displayName}</Label>
        <Input
          id={nameId}
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={100}
          value={displayName}
          onChange={(event) => setDisplayName(event.currentTarget.value)}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${nameId}-error` : undefined}
        />
        {nameError ? (
          <p id={`${nameId}-error`} className="text-destructive text-sm">
            {nameError}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={avatarId}>{dictionary.profile.avatarUrl}</Label>
        <Input
          id={avatarId}
          name="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.currentTarget.value)}
          aria-invalid={avatarError ? true : undefined}
          aria-describedby={avatarError ? `${avatarId}-error` : undefined}
        />
        {avatarError ? (
          <p id={`${avatarId}-error`} className="text-destructive text-sm">
            {avatarError}
          </p>
        ) : null}
      </div>
      <SubmitButton>{dictionary.profile.save}</SubmitButton>
    </form>
  );
}
