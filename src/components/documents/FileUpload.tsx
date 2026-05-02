"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, File, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type DocType = "bank_statement" | "contract_note" | "fund_statement" | "other";

interface PendingFile {
  file: File;
  docType: DocType;
  month: string;
  year: string;
}

export function FileUpload() {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const onDrop = useCallback((accepted: File[]) => {
    const now = new Date();
    const newFiles: PendingFile[] = accepted.map((file) => ({
      file,
      docType: guessDocType(file.name),
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png"] },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  function guessDocType(name: string): DocType {
    const lower = name.toLowerCase();
    if (lower.includes("statement") || lower.includes("bank")) return "bank_statement";
    if (lower.includes("contract") || lower.includes("note") || lower.includes("cn")) return "contract_note";
    if (lower.includes("fund")) return "fund_statement";
    return "other";
  }

  function removePending(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();

    try {
      for (const pf of pendingFiles) {
        const ext = pf.file.name.split(".").pop();
        const path = `documents/${Date.now()}-${pf.file.name.replace(/\s+/g, "_")}`;

        const { error: storageError } = await supabase.storage
          .from("eig-documents")
          .upload(path, pf.file, { contentType: pf.file.type });

        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from("documents").insert({
          document_type: pf.docType,
          file_name: pf.file.name,
          file_path: path,
          file_size: pf.file.size,
          mime_type: pf.file.type,
          period_month: pf.month ? parseInt(pf.month) : null,
          period_year: pf.year ? parseInt(pf.year) : null,
          processing_status: "pending",
          uploaded_by: user?.id ?? null,
        });

        if (dbError) throw dbError;
      }

      // Trigger processing
      await fetch("/api/documents/process", { method: "POST" }).catch(() => null);

      toast.success(`${pendingFiles.length} file(s) uploaded successfully`);
      setPendingFiles([]);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">
          {isDragActive ? "Drop files here" : "Drag & drop files or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, JPG, PNG up to 10MB each. Bank statements, contract notes, fund statements.
        </p>
      </div>

      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <File className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">{pf.file.name}</span>

              <select
                value={pf.docType}
                onChange={(e) => {
                  const updated = [...pendingFiles];
                  updated[i] = { ...pf, docType: e.target.value as DocType };
                  setPendingFiles(updated);
                }}
                className="text-xs border border-input bg-background rounded px-2 py-1 focus:outline-none"
              >
                <option value="bank_statement">Bank Statement</option>
                <option value="contract_note">Contract Note</option>
                <option value="fund_statement">Fund Statement</option>
                <option value="other">Other</option>
              </select>

              <select
                value={pf.month}
                onChange={(e) => {
                  const updated = [...pendingFiles];
                  updated[i] = { ...pf, month: e.target.value };
                  setPendingFiles(updated);
                }}
                className="text-xs border border-input bg-background rounded px-2 py-1 focus:outline-none"
              >
                {months.map((m, mi) => (
                  <option key={m} value={String(mi + 1)}>{m.slice(0, 3)}</option>
                ))}
              </select>

              <input
                type="number"
                value={pf.year}
                onChange={(e) => {
                  const updated = [...pendingFiles];
                  updated[i] = { ...pf, year: e.target.value };
                  setPendingFiles(updated);
                }}
                className="text-xs border border-input bg-background rounded px-2 py-1 w-16 focus:outline-none"
              />

              <button onClick={() => removePending(i)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
