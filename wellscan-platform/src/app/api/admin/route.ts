import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const db = dbClient();
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { data: profile, error: profileErr } = await db.from("wellscan_profiles").select("role").eq("id", auth.user.id).single();
    if (profileErr || profile?.role !== "admin") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

    const [scans, users, dictionary] = await Promise.all([
      db.from("wellscan_scans").select("id,user_id,created_at,product_name,profile_id,source_language,output_language,status").order("created_at", { ascending: false }).limit(200),
      db.from("wellscan_profiles").select("id,email,role,created_at").order("created_at", { ascending: false }).limit(200),
      db.from("wellscan_ingredient_dictionary").select("id,canonical_name_ko,canonical_name_en,aliases,category,review_status,updated_at").order("updated_at", { ascending: false }).limit(200)
    ]);
    if (scans.error) throw scans.error;
    return NextResponse.json({
      scans: scans.data || [],
      users: users.data || [],
      ingredients: dictionary.data || [],
      stats: { scans: scans.data?.length || 0, users: users.data?.length || 0, pendingIngredients: dictionary.data?.filter(x => x.review_status !== "approved").length || 0 }
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "관리자 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const db = dbClient();
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { data: profile } = await db.from("wellscan_profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    const body = await req.json();
    if (body.action === "upsert_ingredient") {
      const record = {
        canonical_name_ko: String(body.canonical_name_ko || "").trim(),
        canonical_name_en: String(body.canonical_name_en || "").trim(),
        aliases: Array.isArray(body.aliases) ? body.aliases.filter((x: unknown) => typeof x === "string").slice(0, 100) : [],
        category: String(body.category || "general").slice(0, 100),
        review_status: body.review_status === "approved" ? "approved" : "pending",
        updated_at: new Date().toISOString()
      };
      if (!record.canonical_name_ko || !record.canonical_name_en) return NextResponse.json({ error: "한국어·영어 표준 성분명을 모두 입력해 주세요." }, { status: 400 });
      const query = body.id ? db.from("wellscan_ingredient_dictionary").update(record).eq("id", body.id).select().single() : db.from("wellscan_ingredient_dictionary").insert(record).select().single();
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ item: data });
    }
    return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "저장에 실패했습니다." }, { status: 500 });
  }
}
