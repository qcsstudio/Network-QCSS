import type { ReactNode } from "react";
import { AdminActionCenter } from "@/components/admin-action-center";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}<AdminActionCenter /></>;
}
