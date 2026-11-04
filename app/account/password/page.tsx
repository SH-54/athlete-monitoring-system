import { redirect } from "next/navigation";
import { configured, serverSupabase } from "@/lib/supabase";
import PasswordForm from "@/components/password-form";
export const dynamic = "force-dynamic";
export default async function Password() {
  if (!configured()) redirect("/");
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/");
  return <PasswordForm />;
}
