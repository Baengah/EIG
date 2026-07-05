"use client";

import { Download } from "lucide-react";

export interface StatementRow {
  id: string;
  date: string;
  description: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string | null;
}

interface Props {
  rows: StatementRow[];
  filename?: string;
}

export function DownloadStatementButton({ rows, filename }: Props) {
  const handleDownload = async () => {
    const XLSX = await import("xlsx");

    const headers = [
      "Date", "Description", "Reference", "Type",
      "Debit (₦)", "Credit (₦)", "Balance (₦)",
    ];

    // Export oldest-first for a natural running-balance view
    const dataRows = [...rows].reverse().map(r => [
      r.date,
      r.description,
      r.reference ?? "",
      r.category,
      r.debit  > 0 ? r.debit  : "",
      r.credit > 0 ? r.credit : "",
      r.balance,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = [
      { wch: 12 }, { wch: 42 }, { wch: 22 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Account Statement");

    const defaultName = `EIG_Account_Statement_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename ?? defaultName);
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors border border-border"
    >
      <Download className="w-3.5 h-3.5" />
      Download Excel
    </button>
  );
}
