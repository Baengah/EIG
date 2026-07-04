import { redirect } from "next/navigation";

export default function NavRedirect() {
  redirect("/portfolio?tab=nav");
}
