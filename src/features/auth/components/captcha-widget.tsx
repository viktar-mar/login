"use client";

import Script from "next/script";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authConfig } from "@/config/auth";
import { useDictionary } from "@/i18n/provider";

type Turnstile = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      theme: "light" | "dark" | "auto";
      size: "compact";
      "response-field": false;
      retry: "never";
      "refresh-expired": "never";
      "refresh-timeout": "never";
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
      "timeout-callback"(): void;
    },
  ): string;
  remove(widgetId: string): void;
};

function getTurnstile() {
  return (window as Window & { turnstile?: Turnstile }).turnstile;
}

export function CaptchaWidget({
  onTokenChange,
  resetKey,
}: {
  onTokenChange(token: string): void;
  resetKey: number;
}) {
  const { locale, dictionary } = useDictionary();
  const { resolvedTheme } = useTheme();
  const theme =
    resolvedTheme === "dark" || resolvedTheme === "light"
      ? resolvedTheme
      : "auto";
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<
    "loading" | "pending" | "verified" | "failed" | "expired"
  >("loading");

  const scriptReady = useCallback(() => {
    if (getTurnstile()) setReady(true);
  }, []);

  useEffect(() => {
    // Next Script deduplicates in-flight loads, but onReady can belong to an
    // unmounted form (or fire early on a third mount). Observe the actual load.
    const script = document.getElementById("cloudflare-turnstile");
    script?.addEventListener("load", scriptReady);
    scriptReady();
    return () => script?.removeEventListener("load", scriptReady);
  }, [scriptReady]);

  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setStatus("failed"), 15000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready || !container.current) return;
    const api = getTurnstile();
    if (!api) {
      setStatus("failed");
      return;
    }
    let active = true;
    let acceptingToken = true;
    onTokenChange("");
    setStatus("pending");
    const fail = (reason: "failed" | "expired") => {
      if (!active) return;
      acceptingToken = false;
      onTokenChange("");
      setStatus(reason);
    };
    let widgetId: string | undefined;
    try {
      widgetId = api.render(container.current, {
        sitekey: authConfig.captcha.siteKey,
        language: locale,
        theme,
        size: "compact",
        "response-field": false,
        retry: "never",
        "refresh-expired": "never",
        "refresh-timeout": "never",
        callback: (token) => {
          if (!active || !acceptingToken) return;
          onTokenChange(token);
          setStatus("verified");
        },
        "error-callback": () => fail("failed"),
        "expired-callback": () => fail("expired"),
        "timeout-callback": () => fail("expired"),
      });
    } catch {
      fail("failed");
    }
    return () => {
      active = false;
      onTokenChange("");
      if (widgetId !== undefined) api.remove(widgetId);
    };
  }, [ready, attempt, resetKey, locale, theme, onTokenChange]);

  const failed = status === "failed" || status === "expired";
  const message = status === "pending" ? null : dictionary.captcha[status];

  return (
    <div className="space-y-2">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={scriptReady}
        onLoad={scriptReady}
        onError={() => {
          onTokenChange("");
          setStatus("failed");
        }}
      />
      <div ref={container} className="min-h-35" />
      {message ? (
        <p
          role={failed ? "alert" : "status"}
          className="text-muted-foreground text-sm"
        >
          {message}
        </p>
      ) : null}
      {failed ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Next Script caches failed loads. Reload to retry the actual network request.
            if (!ready || !getTurnstile()) {
              window.location.reload();
              return;
            }
            setAttempt((value) => value + 1);
          }}
        >
          {dictionary.captcha.retry}
        </Button>
      ) : null}
    </div>
  );
}
