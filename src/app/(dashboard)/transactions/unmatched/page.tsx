import { redirect } from "next/navigation";

export default function LedgerRedirect() {
  redirect("/transactions?tab=ledger");
}
