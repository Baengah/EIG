import { redirect } from "next/navigation";

export default function UnitsRedirect() {
  redirect("/portfolio?tab=units");
}
