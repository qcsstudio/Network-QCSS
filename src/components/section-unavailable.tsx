import { AlertTriangle, RefreshCw } from "lucide-react";

export function SectionUnavailable({ title, admin = false }: { title: string; admin?: boolean }) {
  return (
    <section className="section-unavailable" role="status">
      <AlertTriangle aria-hidden="true" size={24} />
      <div>
        <h2>{title}: temporarily unavailable</h2>
        <p>{admin
          ? "The data service could not be reached. Check database capacity and connectivity. Actions in this module remain unavailable until its data loads; access controls have not changed."
          : "We cannot retrieve the latest records right now. This does not mean there are no advisories or updates. Please check again shortly."}</p>
        <a href={admin ? "/admin" : "/intelligence"} className="text-link"><RefreshCw size={16} aria-hidden="true" /> Check again</a>
      </div>
    </section>
  );
}
