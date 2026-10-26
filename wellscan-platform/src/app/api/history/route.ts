import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase 환경변수를 설정해 주세요." }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "로그인 세션이 유효하지 않습니다." }, { status: 401 });
  const { data, error } = await db.from("wellscan_scans").select("id,created_at,product_name,profile_id,status,result_json,source_language").eq("user_id", authData.user.id).order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "기록을 불러오지 못했습니다." }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}
