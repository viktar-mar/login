"use client";

import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { useDictionary } from "@/i18n/provider";

export default function HomePage() {
  const { dictionary } = useDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <Image
        src={siteConfig.logo}
        alt={siteConfig.name}
        width={80}
        height={80}
        loading="eager"
      />
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          {siteConfig.name}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {dictionary.home.productName}
        </h1>
        <p className="text-muted-foreground">{dictionary.home.description}</p>
      </div>
      <Link
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 font-medium transition"
        href="/login"
      >
        {dictionary.auth.signIn}
      </Link>
      <Link
        className="font-medium underline underline-offset-4"
        href="/dashboard"
      >
        {dictionary.navigation.dashboard}
      </Link>
    </main>
  );
}
