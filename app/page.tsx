import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function Home() {
  await requireProfile();
  redirect("/dashboard");
}
