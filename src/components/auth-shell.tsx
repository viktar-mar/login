import Image from "next/image";
import { siteConfig } from "@/config/site";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export type AuthShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="flex min-h-[calc(100svh-5rem)] w-full min-w-0 items-center justify-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-md min-w-0">
        <CardHeader className="items-center text-center">
          <Image
            src={siteConfig.logo}
            alt={siteConfig.name}
            width={64}
            height={64}
            priority
          />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="min-w-0">{children}</CardContent>
        {footer ? (
          <CardFooter className="text-muted-foreground justify-center text-center text-sm">
            {footer}
          </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}
