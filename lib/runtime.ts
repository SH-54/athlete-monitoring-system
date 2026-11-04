export type RuntimeMode = "demo" | "live" | "unconfigured";
export function runtimeMode(config: {
  production: boolean;
  url?: string;
  key?: string;
  demo?: string;
}): RuntimeMode {
  const hasURL = !!config.url,
    hasKey = !!config.key;
  if (hasURL && hasKey) {
    try {
      const u = new URL(config.url!);
      if (
        u.protocol !== "https:" &&
        !(
          u.protocol === "http:" &&
          !config.production &&
          ["127.0.0.1", "localhost"].includes(u.hostname)
        )
      )
        return "unconfigured";
    } catch {
      return "unconfigured";
    }
    if (config.key!.startsWith("sb_secret_")) return "unconfigured";
    // Legacy Supabase JWTs must be anon keys; a service-role key must never enter the browser.
    if (config.key!.split(".").length === 3) {
      try {
        const body = JSON.parse(
          Buffer.from(config.key!.split(".")[1], "base64url").toString(),
        );
        if (body.role !== "anon") return "unconfigured";
      } catch {
        return "unconfigured";
      }
    }
    return "live";
  }
  if (hasURL || hasKey) return "unconfigured";
  return config.demo === "true" ||
    (!config.production && config.demo !== "false")
    ? "demo"
    : "unconfigured";
}
export function serverMode() {
  return runtimeMode({
    production: process.env.NODE_ENV === "production",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    demo: process.env.ATHLOS_DEMO_MODE,
  });
}
export function safeNext(path: string | null) {
  return path?.startsWith("/") &&
    !path.startsWith("//") &&
    !/[\\\r\n]/.test(path)
    ? path
    : "/";
}
