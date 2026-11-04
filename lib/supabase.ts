import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverMode } from "./runtime";
export function configured() {
  return serverMode() === "live";
}
export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server component cookies are refreshed by proxy. */
          }
        },
      },
    },
  );
}
