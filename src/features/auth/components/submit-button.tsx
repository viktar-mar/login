"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type SubmitButtonProps = Omit<
  ComponentProps<typeof Button>,
  "type" | "disabled"
>;

export function SubmitButton({ children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} type="submit" disabled={pending}>
      {pending ? <Spinner /> : null}
      <span>{children}</span>
    </Button>
  );
}
