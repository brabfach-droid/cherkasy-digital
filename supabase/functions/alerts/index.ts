import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeAlerts } from "./provider.ts";
// Only cron calls this function. Public clients read the sanitized cached state through RLS.
Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("ALERTS_SYNC_SECRET");
  const supplied = req.headers.get("x-sync-secret");
  if (
    !secret ||
    secret.length < 32 ||
    secret.startsWith("GENERATE_") ||
    !supplied ||
    supplied !== secret
  )
    return new Response("Forbidden", { status: 403 });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const token = Deno.env.get("ALERTS_API_TOKEN");
  if (!token)
    return Response.json(
      { error: "ALERTS_API_TOKEN is not configured" },
      { status: 503 },
    );
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: acquired, error: leaseError } = await db.rpc(
    "acquire_alerts_lease",
  );
  if (leaseError)
    return Response.json({ error: "Cache unavailable" }, { status: 503 });
  if (!acquired) return Response.json({ cached: true });
  try {
    const response = await fetch(
      "https://api.alerts.in.ua/v1/alerts/active.json",
      {
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("Upstream status " + response.status);
    const body = await response.json();
    const uids = (Deno.env.get("ALERTS_LOCATION_UIDS") || "152")
      .split(",")
      .map((x) => x.trim());
    const oblast = Deno.env.get("ALERTS_OBLAST_TITLE") || "Черкаська область";
    const payload = normalizeAlerts(body, uids, oblast);
    const { error } = await db
      .from("api_cache")
      .update({
        payload,
        refreshed_at: new Date().toISOString(),
        lease_until: null,
        last_error: null,
      })
      .eq("key", "alerts");
    if (error) throw new Error("Cache update failed");
    return Response.json({ updated: true });
  } catch {
    // Keep the last known state; never turn a transport/API failure into an all-clear.
    await db
      .from("api_cache")
      .update({
        last_error: "Джерело тимчасово недоступне",
        lease_until: new Date(Date.now() + 60000).toISOString(),
      })
      .eq("key", "alerts");
    return Response.json(
      { error: "Джерело тимчасово недоступне" },
      { status: 502 },
    );
  }
});
