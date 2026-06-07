import Link from "next/link";
import type { LinkProps } from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";

export function ButtonLink({ children, className, ...props }: LinkProps & { children: ReactNode; className?: string }) {
  return (
    <Link {...props} className={clsx("focus-ring inline-flex min-h-12 items-center justify-center rounded-md px-5 py-3 text-base font-black", className)}>
      {children}
    </Link>
  );
}
