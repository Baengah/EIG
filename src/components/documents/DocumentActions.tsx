"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { DocumentReviewModal } from "./DocumentReviewModal";
import type { Database } from "@/types/database";

type Doc = Database["public"]["Tables"]["documents"]["Row"];

export function DocumentActions({ doc }: { doc: Doc }) {
  const [reviewing, setReviewing] = useState(false);

  if (doc.processing_status !== "completed" || !doc.extracted_data) return null;

  return (
    <>
      <button
        onClick={() => setReviewing(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        <Eye className="w-3.5 h-3.5" />
        Review
      </button>

      {reviewing && (
        <DocumentReviewModal
          doc={{
            id: doc.id,
            document_type: doc.document_type,
            file_name: doc.file_name,
            extracted_data: doc.extracted_data as Record<string, unknown> | null,
          }}
          onClose={() => setReviewing(false)}
        />
      )}
    </>
  );
}
