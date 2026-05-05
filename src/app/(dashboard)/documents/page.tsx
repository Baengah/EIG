import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { FileUpload } from "@/components/documents/FileUpload";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  bank_statement: "Bank Statement",
  contract_note: "Contract Note",
  fund_statement: "Fund Statement",
  other: "Other",
};

const STATUS_ICONS = {
  pending: { icon: Clock, color: "text-amber-600 bg-amber-50" },
  processing: { icon: Clock, color: "text-blue-600 bg-blue-50" },
  completed: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  failed: { icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
};

export const revalidate = 60;

export default async function DocumentsPage() {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .order("upload_date", { ascending: false });

  const docs = documents ?? [];

  const counts = {
    total: docs.length,
    completed: docs.filter((d) => d.processing_status === "completed").length,
    pending: docs.filter((d) => d.processing_status === "pending").length,
    failed: docs.filter((d) => d.processing_status === "failed").length,
  };

  return (
    <div>
      <Header title="Documents" subtitle="Bank statements, contract notes, and fund statements" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Documents", value: counts.total, color: "text-foreground" },
            { label: "Processed", value: counts.completed, color: "text-gain" },
            { label: "Pending", value: counts.pending, color: "text-amber-600" },
            { label: "Failed", value: counts.failed, color: "text-loss" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Upload zone */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Upload Document</h3>
          </div>
          <FileUpload />
        </div>

        {/* Document list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">All Documents</h3>
          </div>

          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No documents uploaded</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload bank statements and contract notes to keep records
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">File</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Uploaded</th>
                    <th className="hidden md:table-cell text-right px-5 py-3 text-xs font-medium text-muted-foreground">Size</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {docs.map((doc) => {
                    const cfg = STATUS_ICONS[doc.processing_status as keyof typeof STATUS_ICONS] ?? STATUS_ICONS.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground truncate max-w-xs">{doc.file_name}</span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                          {TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                          {doc.period_month && doc.period_year
                            ? `${new Date(doc.period_year, doc.period_month - 1).toLocaleString("en-NG", { month: "short", year: "numeric" })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {doc.processing_status}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                          {new Date(doc.upload_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 text-right text-muted-foreground">
                          {doc.file_size
                            ? doc.file_size < 1024 * 1024
                              ? `${(doc.file_size / 1024).toFixed(0)} KB`
                              : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DocumentActions doc={doc} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
