"use client";

import { useState, type InputHTMLAttributes } from "react";
import { HiEye, HiEyeSlash } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDictionary } from "@/i18n/provider";
import { cn } from "@/lib/utils/cn";

export type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function PasswordField({
  label,
  id,
  className,
  ...props
}: PasswordFieldProps) {
  const { dictionary } = useDictionary();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          className={cn("pr-12", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
          aria-label={
            visible
              ? dictionary.auth.hidePassword
              : dictionary.auth.showPassword
          }
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <HiEyeSlash aria-hidden="true" className="size-5" />
          ) : (
            <HiEye aria-hidden="true" className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
