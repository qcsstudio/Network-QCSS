"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isWorkspacePath } from "@/lib/site-navigation";

export function PublicSiteChrome({ children }: { children: ReactNode }) {
  return isWorkspacePath(usePathname()) ? null : children;
}
