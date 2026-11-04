import { serverMode } from "@/lib/runtime";
import { serverSupabase } from "@/lib/supabase";
import JoinForm from "@/components/join-form";
import ConnectionRequired from "@/components/connection-required";
import InvalidInvitation from "@/components/invalid-invitation";
export const dynamic = "force-dynamic";
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (serverMode() !== "live") return <ConnectionRequired />;
  const { token } = await searchParams;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return <InvalidInvitation />;
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  return <JoinForm token={token} email={user?.email} loggedIn={!!user} />;
}
