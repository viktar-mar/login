"use client";

import { useState, useTransition, type ComponentType } from "react";
import {
  FaApple,
  FaDiscord,
  FaFacebook,
  FaGithub,
  FaGoogle,
  FaMicrosoft,
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import type { AuthProvider } from "@/config/env-schema";
import { oauthAction } from "@/features/auth/actions";
import type { AuthActionState } from "@/features/auth/types";
import { useDictionary } from "@/i18n/provider";
import { AuthMessage } from "./auth-message";

type ProviderMetadata = {
  icon: ComponentType<{ "aria-hidden"?: boolean }>;
  label: "google" | "facebook" | "apple" | "github" | "microsoft" | "discord";
};

const providerRegistry: Record<AuthProvider, ProviderMetadata> = {
  google: { icon: FaGoogle, label: "google" },
  facebook: { icon: FaFacebook, label: "facebook" },
  apple: { icon: FaApple, label: "apple" },
  github: { icon: FaGithub, label: "github" },
  azure: { icon: FaMicrosoft, label: "microsoft" },
  discord: { icon: FaDiscord, label: "discord" },
};

export type OAuthButtonsProps = {
  providers: readonly AuthProvider[];
  emailEnabled: boolean;
  next: string;
};

const initialState: AuthActionState = { status: "idle" };

export function OAuthButtons({
  providers,
  emailEnabled,
  next,
}: OAuthButtonsProps) {
  const { dictionary } = useDictionary();
  const [state, setState] = useState<AuthActionState>(initialState);
  const [pending, startTransition] = useTransition();

  if (providers.length === 0) {
    return null;
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      setState(await oauthAction(initialState, formData));
    });
  }

  return (
    <div className="space-y-4">
      <AuthMessage state={state} />

      <div className="space-y-3">
        {providers.map((provider) => {
          const metadata = providerRegistry[provider];
          const Icon = metadata.icon;
          const label = `${dictionary.oauth.continueWith} ${dictionary.oauth[metadata.label]}`;

          return (
            <form action={submit} key={provider}>
              <input type="hidden" name="provider" value={provider} />
              <input type="hidden" name="next" value={next} />
              <Button
                className="w-full"
                type="submit"
                variant="outline"
                disabled={pending}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            </form>
          );
        })}
      </div>

      {emailEnabled ? (
        <div className="flex items-center gap-3" role="separator">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase">
            {dictionary.oauth.or}
          </span>
          <span className="bg-border h-px flex-1" />
        </div>
      ) : null}
    </div>
  );
}
