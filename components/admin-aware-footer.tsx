"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";

export function AdminAwareFooter() {
  const pathname = usePathname();
  if (!pathname || pathname.startsWith("/admin")) return null;
  return <SiteFooter />;
}
