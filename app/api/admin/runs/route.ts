import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!url || !key || !token) return NextResponse.json({ status: "unauthorized", message: "An authenticated admin session is required." }, { status: 401 });

  const supabase = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: identityError } = await supabase.auth.getUser(token);
  if (identityError || !identity.user) return NextResponse.json({ status: "unauthorized", message: "The session could not be verified." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ status: "storage_unavailable", message: "The Supabase profile schema is not ready." }, { status: 503 });
  if (profile?.role !== "admin") return NextResponse.json({ status: "forbidden", message: "The admin role is required." }, { status: 403 });

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 25);
  const limit = Math.max(1, Math.min(50, Number.isFinite(requestedLimit) ? requestedLimit : 25));
  const { data: runs, error: runsError } = await supabase
    .from("saarthi_runs")
    .select("run_id,generated_at,profile,connectivity,location,query,ai_status,source_health,token_usage,central,payload")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (runsError) return NextResponse.json({ status: "storage_unavailable", message: "Recorded workflows are unavailable until the Sarathi storage migration is active." }, { status: 503 });
  return NextResponse.json({ status: "available", runs: runs || [], count: runs?.length || 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
