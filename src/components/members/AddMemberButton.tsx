"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddMemberButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    join_date: new Date().toISOString().split("T")[0],
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    notes: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("members").insert({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        join_date: form.join_date,
        bank_name: form.bank_name || null,
        bank_account_name: form.bank_account_name || null,
        bank_account_number: form.bank_account_number || null,
        notes: form.notes || null,
        is_active: true,
      });
      if (error) throw error;
      toast.success(`${form.full_name} added successfully`);
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { name: "full_name", label: "Full Name *", type: "text", required: true, placeholder: "e.g. Adebayo Okonkwo" },
    { name: "email", label: "Email Address *", type: "email", required: true, placeholder: "member@email.com" },
    { name: "phone", label: "Phone Number", type: "tel", required: false, placeholder: "+234 800 000 0000" },
    { name: "join_date", label: "Join Date *", type: "date", required: true, placeholder: "" },
    { name: "bank_name", label: "Bank Name", type: "text", required: false, placeholder: "e.g. Zenith Bank" },
    { name: "bank_account_name", label: "Account Name", type: "text", required: false, placeholder: "Account holder name" },
    { name: "bank_account_number", label: "Account Number", type: "text", required: false, placeholder: "10-digit account number" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Member
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add New Member</h2>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    name={f.name}
                    value={(form as Record<string, string>)[f.name]}
                    onChange={handleChange}
                    required={f.required}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
