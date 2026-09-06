import { ShieldCheck } from "lucide-react";

export function CcnaLabBoundary({ boundary }: { boundary?: string }) {
  if (!boundary) return null;
  return <aside className="ccna-lab-boundary-note"><ShieldCheck aria-hidden="true" size={20} /><div><strong>Lab boundary</strong><p>{boundary.replace(/^Lab boundary:\s*/i, "")}</p></div></aside>;
}
