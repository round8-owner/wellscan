"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, ClipboardList, LoaderCircle, LogIn, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type AdminData = {
  scans: { id: string; user_id: string; created_at: string; product_name: string | null; profile_id: string; source_language: string | null; output_language: string | null; status: string }[];
  users: { id: string; email: string | null; role: string; created_at: string }[];
  ingredients: { id: string; canonical_name_ko: string; canonical_name_en: string; aliases: string[]; category: string; review_status: string; updated_at: string }[];
  stats: { scans: number; users: number; pendingIngredients: number };
};

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<"overview" | "scans" | "users" | "ingredients">("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ingredient, setIngredient] = useState({ canonical_name_ko: "", canonical_name_en: "", aliases: "", category: "general", review_status: "pending" });

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => { if (data.session) { setToken(data.session.access_token); void load(data.session.access_token); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || "");
      if (session) void load(session.access_token); else setData(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function load(accessToken: string) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin", { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "관리자 데이터를 불러오지 못했습니다.");
      setData(json);
    } catch (e) { setMessage(e instanceof Error ? e.message : "오류가 발생했습니다."); }
    finally { setBusy(false); }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) { setToken(data.session.access_token); await load(data.session.access_token); }
    } catch (e) { setMessage(e instanceof Error ? e.message : "로그인에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function saveIngredient(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "upsert_ingredient", ...ingredient, aliases: ingredient.aliases.split(",").map(x => x.trim()).filter(Boolean) })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "저장에 실패했습니다.");
      setMessage("성분 사전에 저장했습니다.");
      setIngredient({ canonical_name_ko: "", canonical_name_en: "", aliases: "", category: "general", review_status: "pending" });
      await load(token);
    } catch (e) { setMessage(e instanceof Error ? e.message : "저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen">
    <header className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><a href="/" className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ArrowLeft size={16}/> WellScan으로 돌아가기</a><span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><ShieldCheck size={15}/> ADMIN CONSOLE</span></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Operations</p><h1 className="mt-2 text-3xl font-extrabold">관리자 대시보드</h1><p className="muted mt-2 text-sm">사용자 · 분석 기록 · 다국어 성분 사전 검수</p></div>{token && <button onClick={() => void load(token)} className="btn btn-secondary"><RefreshCw size={16}/>새로고침</button>}</div>
      {!token ? <section className="panel mx-auto mt-8 max-w-md p-6"><h2 className="text-xl font-extrabold">관리자 로그인</h2><p className="muted mt-2 text-sm">Supabase 계정으로 로그인합니다. profiles.role이 admin인 계정만 접근할 수 있습니다.</p><form onSubmit={login} className="mt-5 space-y-4"><div><label className="label">이메일</label><input className="field" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></div><div><label className="label">비밀번호</label><input className="field" type="password" required value={password} onChange={e => setPassword(e.target.value)}/></div><button disabled={busy} className="btn btn-primary w-full"><LogIn size={16}/>{busy ? "확인 중…" : "로그인"}</button></form>{message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}</section> :
      <>
        {message && <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</div>}
        {busy && <p className="muted mt-4 flex items-center gap-2 text-sm"><LoaderCircle className="animate-spin" size={16}/> 데이터를 불러오는 중…</p>}
        {data && <>
          <nav className="mt-7 flex flex-wrap gap-2">{([{id:"overview", label:"개요", icon:<BookOpen size={16}/>},{id:"scans",label:"분석 기록",icon:<ClipboardList size={16}/>},{id:"users",label:"사용자",icon:<Users size={16}/>},{id:"ingredients",label:"성분 사전",icon:<ShieldCheck size={16}/>} ] as const).map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`btn !py-2.5 text-sm ${tab === item.id ? "btn-primary" : "btn-ghost"}`}>{item.icon}{item.label}</button>)}</nav>
          {tab === "overview" && <div className="mt-5 grid gap-4 sm:grid-cols-3"><Stat label="최근 분석 기록" value={data.stats.scans} icon={<ClipboardList/>}/><Stat label="조회된 사용자" value={data.stats.users} icon={<Users/>}/><Stat label="검수 대기 성분" value={data.stats.pendingIngredients} icon={<BookOpen/>}/><section className="panel p-5 sm:col-span-3"><h2 className="font-extrabold">운영 체크리스트</h2><ul className="muted mt-3 list-disc space-y-2 pl-5 text-sm"><li>OCR 오류가 잦은 라벨은 원문과 분석 결과를 비교해 검수하세요.</li><li>성분 사전의 한국어·영어 표준명과 별칭을 검수한 뒤 승인 상태로 관리하세요.</li><li>건강 관련 설명은 근거·불확실성·함량 정보를 확인하고 의료적 단정 표현을 피하세요.</li></ul></section></div>}
          {tab === "scans" && <div className="panel mt-5 overflow-x-auto"><Table headers={["일시","제품","프로필","원문 언어","결과 언어","상태"]} rows={data.scans.map(s => [new Date(s.created_at).toLocaleString(), s.product_name || "—", s.profile_id, s.source_language || "—", s.output_language || "—", s.status])}/></div>}
          {tab === "users" && <div className="panel mt-5 overflow-x-auto"><Table headers={["이메일","권한","가입일","사용자 ID"]} rows={data.users.map(u => [u.email || "—", u.role, new Date(u.created_at).toLocaleDateString(), u.id])}/></div>}
          {tab === "ingredients" && <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={saveIngredient} className="panel h-fit p-5"><h2 className="text-lg font-extrabold">성분 사전 항목 추가</h2><p className="muted mt-1 text-xs">표준 성분명과 라벨 별칭을 관리합니다.</p><div className="mt-4 space-y-3"><div><label className="label">표준명 (한국어)</label><input required className="field" value={ingredient.canonical_name_ko} onChange={e => setIngredient({...ingredient, canonical_name_ko:e.target.value})}/></div><div><label className="label">Canonical name (English)</label><input required className="field" value={ingredient.canonical_name_en} onChange={e => setIngredient({...ingredient, canonical_name_en:e.target.value})}/></div><div><label className="label">별칭 / 원문 표기 (쉼표 구분)</label><textarea className="field" rows={3} value={ingredient.aliases} onChange={e => setIngredient({...ingredient, aliases:e.target.value})} placeholder="예: HFCS, high fructose corn syrup"/></div><div><label className="label">분류</label><input className="field" value={ingredient.category} onChange={e => setIngredient({...ingredient, category:e.target.value})}/></div><div><label className="label">검수 상태</label><select className="field" value={ingredient.review_status} onChange={e => setIngredient({...ingredient, review_status:e.target.value})}><option value="pending">검수 대기</option><option value="approved">승인</option></select></div><button disabled={busy} className="btn btn-primary w-full">성분 저장</button></div></form><div className="panel overflow-x-auto"><Table headers={["한국어 표준명","English canonical","별칭","분류","검수 상태"]} rows={data.ingredients.map(i => [i.canonical_name_ko, i.canonical_name_en, (i.aliases || []).join(", "), i.category, i.review_status])}/></div></div>}
        </>}
      </>}
      <p className="muted mt-8 text-xs">접근 제어는 서버에서 Supabase 사용자 세션과 profiles.role을 확인합니다. 클라이언트 화면 숨김만으로 권한을 보호하지 않습니다.</p>
    </div>
  </main>;
}

function Stat({ label, value, icon }: {label:string; value:number; icon:React.ReactNode}) {
  return <section className="panel p-5"><div className="flex items-center justify-between"><span className="muted text-sm">{label}</span><span className="text-emerald-700">{icon}</span></div><p className="mt-4 text-3xl font-extrabold">{value}</p></section>;
}
function Table({headers, rows}:{headers:string[]; rows:string[][]}) {
  return <table className="w-full min-w-[640px] border-collapse text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{headers.map(h => <th key={h} className="border-b border-gray-100 px-4 py-3 font-bold">{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,i)=><tr key={i} className="hover:bg-gray-50">{row.map((cell,j)=><td key={j} className="max-w-64 truncate border-b border-gray-100 px-4 py-3">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="muted px-4 py-8 text-center">데이터가 없습니다.</td></tr>}</tbody></table>;
}
