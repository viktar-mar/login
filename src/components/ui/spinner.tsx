import { forwardRef, type SVGAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type SpinnerProps = SVGAttributes<SVGSVGElement>;

export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={cn("size-4 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  ),
);
Spinner.displayName = "Spinner";
