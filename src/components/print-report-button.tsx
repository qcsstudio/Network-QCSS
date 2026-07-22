"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button className="button primary compact-button" onClick={() => window.print()} type="button">
      <Printer aria-hidden="true" size={17} /> Print or save PDF
    </button>
  );
}
