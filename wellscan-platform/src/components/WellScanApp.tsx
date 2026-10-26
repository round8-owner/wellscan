"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, Clock3, FileText, Globe2, Leaf, LogOut, Settings2, ShieldCheck, Upload, UserRound, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import type { AnalysisResult, ProfileId } from "@/lib/types";
import { createWorker } from "tesseract.js";

const PROFILES: { id: ProfileId; title: string; emoji: string; description: string }[] = [
  { id: "general", title: "일반 사용자", emoji: "🌿", description: "주요 영양·식품 성분 확인" },
  { id: "pregnant", title: "임신 중 관심 성분", emoji: "🤰", description: "임신 중 의료진과 확인할 수 있는 성분" },
  { id: "diabetes", title: "혈당 관리 관심", emoji: "🩺", description: "당류·탄수화물·감미료 관련 정보" },
  { id: "child", title: "어린이 식품 확인", emoji: "👶", description: "알레르기 유발 식품 및 연령별 주의 정보" },
  { id: "nutrition", title: "영양 관리", emoji: "🥗", description: "당류·포화지방·나트륨 등" },
  { id: "allergy", title: "알레르기 확인", emoji: "🛡️", description: "사용자가 지정한 알레르기 성분" }
];

type ScanRow = { id: string; created_at: string; product_name: string | null; profile_id: ProfileId; status: string; result_json: AnalysisResult | null; source_language: string | null };

export default function WellScanApp() {
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const [profile, setProfile] = useState<ProfileId>("general");
  const [outputLanguage, setOutputLanguage] = useState<"ko" | "en">("ko");
  const [ocrLanguage, setOcrLanguage] = useState("eng+kor");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [manualText, setManualText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [token, setToken] = useState("");
  const [history, setHistory] = useState<ScanRow[]>([]);
  const [activeTab, setActiveTab] = useState<"scan" | "history" | "account">("scan");
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [allergies, setAllergies] = useState("");

  const copy = useMemo(() => lang === "ko" ? {
    title: "내 기준으로 확인하는 식품 성분", subtitle: "라벨을 촬영하고, 언어가 달라도 이해하기 쉽게 확인하세요.",
    profile: "분석 프로필", upload: "라벨 사진 촬영 / 업로드", ocr: "사진에서 원재료 읽기", manual: "원재료 텍스트", analyze: "맞춤 성분 분석", scan: "분석하기", history: "기록", account: "계정", signIn: "로그인 / 회원가입",
    disclaimer: "웰스캔은 참고 정보 도구이며 의료 진단이나 섭취 가능 여부를 확정하지 않습니다. 알레르기 또는 질환 관련 판단은 제품 표시와 의료진 안내를 우선하세요.",
    ocrHint: "OCR은 글자를 추출하지만 오탈자가 있을 수 있어요. 분석 전에 반드시 원문을 확인해 주세요.", noHistory: "아직 저장된 분석 기록이 없습니다.", logout: "로그아웃", output: "결과 언어", korean: "한국어", english: "English"
  } : {
    title: "Understand ingredients on your terms", subtitle: "Scan a label and understand ingredients across languages.",
    profile: "Analysis profile", upload: "Take / upload label photo", ocr: "Read ingredients from photo", manual: "Ingredient text", analyze: "Personalized ingredient analysis", scan: "Analyze", history: "History", account: "Account", signIn: "Sign in / Sign up",
    disclaimer: "WellScan provides informational guidance, not a medical diagnosis or a guarantee that a product is safe to consume. For allergies or medical conditions, follow product labeling and professional advice.",
    ocrHint: "OCR may make mistakes. Review the extracted text before analyzing.", noHistory: "No saved analyses yet.", logout: "Sign out", output: "Result language", korean: "한국어", english: "English"
  }, [lang]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session) {
        setToken(session.access_token);
        setUserEmail(session.user.email || "");
        void loadHistory(session.access_token);
      }
    }).catch(() => {});
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || "");
      setUserEmail(session?.user.email || "");
      if (session) void loadHistory(session.access_token);
      else setHistory([]);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadHistory(accessToken: string) {
    try {
      const res = await fetch("/api/history", { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = await res.json();
      if (res.ok) setHistory(json.items || []);
    } catch {}
  }

  async function chooseFile(next: File | null) {
    setFile(next); setResult(null); setOcrText(""); setStatus("");
    if (preview) URL.revokeObjectURL(preview);
    if (!next) { setPreview(""); return; }
    if (!next.type.startsWith("image/")) { setStatus(lang === "ko" ? "이미지 파일을 선택해 주세요." : "Please select an image file."); setFile(null); return; }
    if (next.size > 12 * 1024 * 1024) { setStatus(lang === "ko" ? "이미지는 12MB 이하로 선택해 주세요." : "Please choose an image smaller than 12 MB."); setFile(null); return; }
    setPreview(URL.createObjectURL(next));
  }

  async function runOcr() {
    if (!file) { setStatus(lang === "ko" ? "먼저 라벨 사진을 선택해 주세요." : "Please select a label photo first."); return; }
    setOcrBusy(true); setStatus(lang === "ko" ? "사진에서 글자를 추출하고 있어요. 라벨 언어에 따라 시간이 걸릴 수 있습니다." : "Extracting text from the photo. This may take a moment depending on the label language.");
    try {
      // Tesseract downloads the selected trained-data models on first use; language availability depends on network/CDN access.
      const worker = await createWorker(ocrLanguage);
      let recognizedText = "";
      let confidence = 0;
      try {
        const recognized = await worker.recognize(file);
        recognizedText = recognized.data.text.trim();
        confidence = recognized.data.confidence;
      } finally { await worker.terminate(); }
      setOcrText(recognizedText);
      setManualText(recognizedText);
      setStatus(recognizedText ? (lang === "ko" ? `텍스트 추출 완료 · OCR 신뢰도 약 ${Math.round(confidence)}%` : `Text extracted · OCR confidence about ${Math.round(confidence)}%`) : (lang === "ko" ? "텍스트를 찾지 못했습니다. 선명한 사진을 올리거나 직접 입력해 주세요." : "No text found. Upload a clearer photo or enter the ingredients manually."));
    } catch (e) {
      setStatus(lang === "ko" ? `OCR에 실패했습니다. 원재료명을 직접 입력해 주세요. ${e instanceof Error ? e.message : ""}` : `OCR failed. Please enter the ingredients manually. ${e instanceof Error ? e.message : ""}`);
    } finally { setOcrBusy(false); }
  }

  async function analyze() {
    const ingredients = manualText.trim();
    if (!ingredients) { setStatus(lang === "ko" ? "원재료명을 입력하거나 사진에서 글자를 추출해 주세요." : "Enter ingredients or extract text from a photo."); return; }
    setAnalyzeBusy(true); setStatus(lang === "ko" ? "성분을 정리하고 분석 중입니다…" : "Normalizing ingredients and analyzing…"); setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ingredients, profile, outputLanguage, allergies: allergies.split(",").map(s => s.trim()).filter(Boolean) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석에 실패했습니다.");
      setResult(data.result as AnalysisResult);
      setStatus(lang === "ko" ? "분석이 완료되었습니다. 검출 결과와 불확실성 안내를 확인해 주세요." : "Analysis complete. Review the findings and uncertainty notes.");
      // Guest mode: results are shown in this session and are not saved to an account.
    } catch (e) { setStatus(e instanceof Error ? e.message : (lang === "ko" ? "분석 중 오류가 발생했습니다." : "An error occurred during analysis.")); }
    finally { setAnalyzeBusy(false); }
  }

  async function auth(mode: "signin" | "signup") {
    setAuthBusy(true);
    try {
      const supabase = getSupabase();
      const { data, error } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) { setToken(data.session.access_token); setUserEmail(data.user?.email || email); setAuthOpen(false); }
      else setStatus("회원가입 요청을 받았습니다. 이메일 인증을 완료한 뒤 로그인해 주세요.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "인증에 실패했습니다."); }
    finally { setAuthBusy(false); }
  }

  async function logout() { await getSupabase().auth.signOut(); setToken(""); setUserEmail(""); setHistory([]); setResult(null); }
  const activeProfile = PROFILES.find(p => p.id === profile)!;

  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-[#e5e9da] bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
        <a href="/" className="flex min-w-0 shrink-0 items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf0dc] text-[#617a38] sm:h-10 sm:w-10"><Leaf size={22}/></span><span><strong className="block text-lg font-extrabold text-[#536a2d]">WellScan</strong><small className="muted hidden text-[10px] sm:block">INGREDIENT INTELLIGENCE</small></span></a>
        <div className="flex items-center gap-2">
          <Globe2 size={16} className="muted hidden sm:block"/>
          <select aria-label="UI language" className="field !w-auto max-w-[104px] !px-2 !py-2 text-xs sm:max-w-none sm:text-sm" value={lang} onChange={e => setLang(e.target.value as "ko"|"en")}><option value="ko">한국어</option><option value="en">English</option></select>
          {<span className="hidden text-xs font-medium text-[#617a38] sm:inline">{lang === "ko" ? "바로 사용" : "Guest access"}</span>}
        </div>
      </div>
    </header>

    <main className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-10">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <section className="min-w-0 rounded-3xl bg-[#eaf0dc] p-5 text-[#28321d] sm:p-8">
          <div className="mb-4 inline-flex rounded-2xl bg-white p-3 text-[#617a38] shadow-sm"><Camera size={24}/></div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#65754c]">{lang === "ko" ? "AI 식품 라벨 리더" : "AI-powered label reader"}</p>
          <h1 className="max-w-xl text-2xl font-extrabold leading-tight sm:text-3xl">{copy.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#4e5b3d]">{copy.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1.5 text-[#536a2d]">OCR</span><span className="rounded-full bg-white px-3 py-1.5 text-[#536a2d]">{lang === "ko" ? "다국어 성분 정규화" : "Multilingual ingredient matching"}</span><span className="rounded-full bg-white px-3 py-1.5 text-[#536a2d]">{lang === "ko" ? "맞춤형 정보" : "Personalized insights"}</span></div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">{copy.profile}</h2><p className="muted mt-1 text-xs">{lang === "ko" ? "프로필은 분석 우선순위를 정합니다. 의료 진단을 대신하지 않습니다." : "Your profile guides the analysis; it does not replace medical advice."}</p></div><span className="rounded-xl bg-[#f4f7ee] p-2 text-xl">{activeProfile.emoji}</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROFILES.map(p => <button key={p.id} onClick={() => setProfile(p.id)} className={`min-w-0 break-words rounded-xl border p-3 text-left transition ${profile === p.id ? "border-[#9caf70] bg-[#f4f7ee] ring-2 ring-[#e5ebd8]" : "border-gray-200 hover:border-[#c9d5ad]"}`}><span className="text-lg">{p.emoji}</span><strong className="mt-1 block text-sm">{lang === "ko" ? p.title : ({ general: "General", pregnant: "Pregnancy considerations", diabetes: "Blood sugar", child: "Children’s food", nutrition: "Nutrition", allergy: "Allergy check" } as Record<ProfileId, string>)[p.id]}</strong><small className="muted mt-1 block text-[11px] leading-relaxed">{lang === "ko" ? p.description : ({ general: "Key nutrition and ingredient information", pregnant: "Ingredients to discuss with a clinician", diabetes: "Sugars, carbohydrates, and sweeteners", child: "Allergens and age-related considerations", nutrition: "Sugar, saturated fat, and sodium", allergy: "Ingredients you identify as allergens" } as Record<ProfileId, string>)[p.id]}</small></button>)}
          </div>
          {profile === "allergy" && <div className="mt-4"><label className="label">{lang === "ko" ? "알레르기 성분 (쉼표로 구분)" : "Allergens (separated by commas)"}</label><input className="field" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder={lang === "ko" ? "예: 땅콩, 우유, 새우" : "e.g. peanut, milk, shrimp"}/></div>}
        </section>

        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">1. {lang === "ko" ? "제품 라벨 촬영" : "Scan product label"}</h2><p className="muted mt-1 text-xs">{lang === "ko" ? "원재료명과 영양정보가 선명하게 보이도록 촬영하세요. 최대 12MB." : "Capture ingredients and nutrition details clearly. Maximum 12 MB."}</p>
          <div className="mt-4 max-w-sm"><label className="label">{lang === "ko" ? "라벨 원문 언어" : "Label language"}</label><select className="field" value={ocrLanguage} onChange={e => setOcrLanguage(e.target.value)}><option value="eng+kor">{lang === "ko" ? "영어 + 한국어" : "English + Korean"}</option><option value="eng">{lang === "ko" ? "영어" : "English"}</option><option value="tha">{lang === "ko" ? "태국어" : "Thai"}</option><option value="jpn">{lang === "ko" ? "일본어" : "Japanese"}</option><option value="chi_sim">{lang === "ko" ? "중국어 간체" : "Simplified Chinese"}</option><option value="chi_tra">{lang === "ko" ? "중국어 번체" : "Traditional Chinese"}</option><option value="vie">{lang === "ko" ? "베트남어" : "Vietnamese"}</option><option value="spa">{lang === "ko" ? "스페인어" : "Spanish"}</option><option value="fra">{lang === "ko" ? "프랑스어" : "French"}</option><option value="deu">{lang === "ko" ? "독일어" : "German"}</option><option value="ind">{lang === "ko" ? "인도네시아어" : "Indonesian"}</option><option value="msa">{lang === "ko" ? "말레이어" : "Malay"}</option><option value="ara">{lang === "ko" ? "아랍어" : "Arabic"}</option><option value="ben">{lang === "ko" ? "벵골어" : "Bengali"}</option><option value="bul">{lang === "ko" ? "불가리아어" : "Bulgarian"}</option><option value="cat">{lang === "ko" ? "카탈루냐어" : "Catalan"}</option><option value="ces">{lang === "ko" ? "체코어" : "Czech"}</option><option value="dan">{lang === "ko" ? "덴마크어" : "Danish"}</option><option value="ell">{lang === "ko" ? "그리스어" : "Greek"}</option><option value="fas">{lang === "ko" ? "페르시아어" : "Persian"}</option><option value="fin">{lang === "ko" ? "핀란드어" : "Finnish"}</option><option value="heb">{lang === "ko" ? "히브리어" : "Hebrew"}</option><option value="hin">{lang === "ko" ? "힌디어" : "Hindi"}</option><option value="hrv">{lang === "ko" ? "크로아티아어" : "Croatian"}</option><option value="hun">{lang === "ko" ? "헝가리어" : "Hungarian"}</option><option value="ita">{lang === "ko" ? "이탈리아어" : "Italian"}</option><option value="nld">{lang === "ko" ? "네덜란드어" : "Dutch"}</option><option value="nor">{lang === "ko" ? "노르웨이어" : "Norwegian"}</option><option value="pol">{lang === "ko" ? "폴란드어" : "Polish"}</option><option value="por">{lang === "ko" ? "포르투갈어" : "Portuguese"}</option><option value="ron">{lang === "ko" ? "루마니아어" : "Romanian"}</option><option value="rus">{lang === "ko" ? "러시아어" : "Russian"}</option><option value="swe">{lang === "ko" ? "스웨덴어" : "Swedish"}</option><option value="tam">{lang === "ko" ? "타밀어" : "Tamil"}</option><option value="tel">{lang === "ko" ? "텔루구어" : "Telugu"}</option><option value="tur">{lang === "ko" ? "튀르키예어" : "Turkish"}</option><option value="ukr">{lang === "ko" ? "우크라이나어" : "Ukrainian"}</option></select><p className="muted mt-1 text-xs">{lang === "ko" ? "언어 모델은 최초 사용 시 다운로드됩니다. 혼합 언어·작은 글씨·반사된 포장에서는 OCR 결과를 직접 확인해 주세요." : "Language data downloads on first use. Check OCR carefully for mixed languages, small print, or reflective packaging."}</p></div>
          <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d8e2c4] bg-[#f4f7ee] p-5 text-center hover:bg-[#f4f7ee]">
            <Upload className="mb-2 text-[#617a38]" size={25}/><strong className="text-sm">{copy.upload}</strong><span className="muted mt-1 text-xs">JPG, PNG, WEBP</span>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => void chooseFile(e.target.files?.[0] || null)}/>
          </label>
          {preview && <div className="mt-4 grid grid-cols-[100px_1fr] gap-3 rounded-xl bg-gray-50 p-3"><img src={preview} alt="Product label preview" className="h-28 w-24 rounded-lg object-contain bg-white"/><div className="min-w-0"><strong className="block break-all text-sm">{file?.name}</strong><p className="muted mt-1 text-xs">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}</p><button onClick={() => void runOcr()} disabled={ocrBusy} className="btn btn-primary mt-3 !py-2 text-xs">{ocrBusy ? "글자 추출 중…" : <><FileText size={15}/>{copy.ocr}</>}</button></div></div>}
          <p className="muted mt-3 text-xs leading-relaxed">{copy.ocrHint} {lang === "ko" ? "OCR은 선택한 언어 모델로 텍스트를 추출하며, 분석 결과는 한국어 또는 영어로 표시할 수 있습니다." : "OCR uses the selected language model. Analysis results can be displayed in Korean or English."}</p>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">2. {lang === "ko" ? copy.manual : "Ingredient text"}</h2><span className="tag tag-info">{lang === "ko" ? "원문 보존" : "Original text preserved"}</span></div>
          <textarea className="field min-h-40 resize-y text-sm leading-relaxed" value={manualText} onChange={e => setManualText(e.target.value)} placeholder={lang === "ko" ? "OCR 결과가 여기에 표시됩니다. 직접 붙여 넣거나 수정할 수 있습니다." : "OCR text appears here. You can paste or edit the ingredients."}/>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="label">{copy.output}</label><select className="field" value={outputLanguage} onChange={e => setOutputLanguage(e.target.value as "ko"|"en")}><option value="ko">{copy.korean}</option><option value="en">{copy.english}</option></select></div>
            <div className="flex items-end"><button disabled={analyzeBusy} onClick={() => void analyze()} className="btn btn-primary w-full">{analyzeBusy ? "분석 중…" : <><ShieldCheck size={17}/>{copy.analyze}</>}</button></div>
          </div>
          {status && <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600" role="status">{status}</div>}
        </section>

        {result && <section className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="muted text-xs">{lang === "ko" ? "분석 결과" : "ANALYSIS REPORT"}</p><h2 className="mt-1 text-xl font-extrabold">{result.product_name || (outputLanguage === "ko" ? "제품 분석 결과" : "Product analysis")}</h2></div><span className={`tag ${result.needs_user_review ? "tag-caution" : "tag-info"}`}>{result.needs_user_review ? (lang === "ko" ? "확인 필요" : "Review needed") : (lang === "ko" ? "참고 결과" : "Informational")}</span></div>
          <p className="mt-4 rounded-xl bg-[#f4f7ee] p-4 text-sm leading-relaxed text-[#28321d]">{result.overall_summary}</p>
          <div className="mt-4 flex items-center justify-between"><h3 className="font-extrabold">{lang === "ko" ? "성분별 결과" : "Ingredient findings"}</h3><span className="muted text-xs">{result.ingredients.length} items</span></div>
          <div className="mt-3 space-y-3">
            {result.ingredients.map((item, i) => <article key={`${item.original_name}-${i}`} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{item.normalized_name}</strong><p className="muted mt-1 text-xs">{lang === "ko" ? "원문" : "Original"}: {item.original_name}</p></div><span className={`tag ${item.level === "high_caution" ? "tag-high" : item.level === "caution" ? "tag-caution" : item.level === "unknown" ? "tag-unknown" : "tag-info"}`}>{lang === "ko" ? ({ info: "정보", caution: "주의", high_caution: "높은 주의", unknown: "확인 필요" } as Record<string, string>)[item.level] || "확인 필요" : ({ info: "Info", caution: "Caution", high_caution: "High caution", unknown: "Unknown" } as Record<string, string>)[item.level] || "Unknown"}</span></div>
              <p className="mt-3 text-sm leading-relaxed">{item.reason}</p>
              {item.profile_relevance && <p className="mt-2 text-xs leading-relaxed text-[#536a2d]">{lang === "ko" ? "프로필 관련성" : "Profile relevance"}: {item.profile_relevance}</p>}
              {item.evidence_note && <p className="muted mt-2 text-xs leading-relaxed">{lang === "ko" ? "근거·한계" : "Evidence & limitations"}: {item.evidence_note}</p>}
            </article>)}
            {!result.ingredients.length && <p className="muted rounded-xl bg-gray-50 p-4 text-sm">{lang === "ko" ? "검토할 성분을 특정하지 못했습니다. OCR 텍스트를 수정하거나 원재료를 직접 입력해 주세요." : "No ingredients could be identified. Edit the OCR text or enter the ingredients manually."}</p>}
          </div>
          {result.uncertainty_notes?.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><strong className="text-sm">{lang === "ko" ? "불확실성 및 추가 확인" : "Uncertainties & follow-up checks"}</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">{result.uncertainty_notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
          <p className="muted mt-4 border-t border-gray-100 pt-4 text-xs leading-relaxed">{result.disclaimer}</p>
        </section>}
      </div>

      <aside className="min-w-0 space-y-4 sm:space-y-5">
        <section className="panel p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="text-[#617a38]" size={20}/><h2 className="font-extrabold">{lang === "ko" ? "분석 원칙" : "Analysis principles"}</h2></div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#809b45]" size={16}/><span>{lang === "ko" ? "제품 원문과 표준 성분명을 구분해 표시" : "Distinguishes original label text from standardized ingredient names"}</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#809b45]" size={16}/><span>{lang === "ko" ? "모르는 성분은 확정 판정 대신 추가 확인으로 표시" : "Flags unknown ingredients for review instead of making definitive claims"}</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#809b45]" size={16}/><span>{lang === "ko" ? "성분 존재와 실제 위험도는 별개로 설명" : "Separates ingredient presence from actual risk"}</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#809b45]" size={16}/><span>{lang === "ko" ? "한국어·영어 결과 선택 가능" : "Choose Korean or English for results"}</span></li>
          </ul>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between"><h2 className="font-extrabold">{copy.history}</h2><span className="text-xs font-medium text-[#617a38]">{lang === "ko" ? "게스트 모드" : "Guest mode"}</span></div>
          {!token ? <p className="muted mt-3 text-sm">{lang === "ko" ? "회원가입 없이 바로 분석할 수 있습니다. 기록은 현재 세션에만 표시되며 계정에 저장되지 않습니다." : "Analyze without signing up. Results stay in this session and are not saved to an account."}</p> : history.length === 0 ? <p className="muted mt-3 text-sm">{copy.noHistory}</p> : <div className="mt-3 space-y-3">{history.slice(0, 4).map(row => <button key={row.id} onClick={() => { if (row.result_json) setResult(row.result_json); setActiveTab("scan"); }} className="block w-full rounded-xl bg-gray-50 p-3 text-left hover:bg-[#f4f7ee]"><span className="block truncate text-sm font-bold">{row.product_name || "제품 분석"}</span><span className="muted mt-1 flex items-center gap-1 text-[11px]"><Clock3 size={12}/>{new Date(row.created_at).toLocaleString()}</span></button>)}</div>}
        </section>

        <section className="panel p-5">
          <div className="flex items-center gap-2"><UserRound size={18} className="text-[#617a38]"/><h2 className="font-extrabold">{copy.account}</h2></div>
          {userEmail ? <><p className="mt-3 break-all text-sm">{userEmail}</p><button onClick={() => void logout()} className="btn btn-ghost mt-3 w-full text-sm"><LogOut size={15}/>{copy.logout}</button><a href="/admin" className="mt-3 block text-center text-xs font-bold text-[#617a38]">관리자 화면 열기 →</a></> : <><p className="muted mt-2 text-sm">{lang === "ko" ? "게스트 모드로 이용 중입니다. 회원가입 없이 모든 성분 분석 기능을 사용할 수 있습니다." : "You are using guest mode. Ingredient analysis is available without an account."}</p></>}
        </section>
        <p className="muted px-1 text-[11px] leading-relaxed">{copy.disclaimer}</p>
      </aside>
    </main>

    {activeTab === "history" && <div className="fixed inset-0 z-30 overflow-y-auto bg-black/40 p-4" onClick={() => setActiveTab("scan")}><div className="mx-auto mt-16 max-w-xl rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">분석 기록</h2><button onClick={() => setActiveTab("scan")}><X/></button></div>{history.length === 0 ? <p className="muted py-8 text-center text-sm">{copy.noHistory}</p> : <div className="mt-4 space-y-2">{history.map(row => <div key={row.id} className="rounded-xl border border-gray-200 p-3"><strong className="text-sm">{row.product_name || (lang === "ko" ? "제품 분석" : "Product analysis")}</strong><p className="muted mt-1 text-xs">{new Date(row.created_at).toLocaleString()} · {lang === "ko" ? row.profile_id : ({ general: "General", pregnant: "Pregnancy", diabetes: "Blood sugar", child: "Children", nutrition: "Nutrition", allergy: "Allergy" } as Record<ProfileId, string>)[row.profile_id]}</p></div>)}</div>}</div></div>}

    {authOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAuthOpen(false)}><div className="w-full max-w-sm rounded-3xl bg-white p-6" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold">WellScan 계정</h2><button onClick={() => setAuthOpen(false)}><X/></button></div><p className="muted mt-2 text-sm">분석 기록을 저장하고 다시 확인할 수 있습니다.</p><form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); void auth("signin"); }}><div><label className="label">이메일</label><input type="email" required className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></div><div><label className="label">비밀번호 (최소 6자)</label><input type="password" required minLength={6} className="field" value={password} onChange={e => setPassword(e.target.value)}/></div><button disabled={authBusy} className="btn btn-primary w-full">{authBusy ? "처리 중…" : "로그인"}</button><button type="button" disabled={authBusy} onClick={() => void auth("signup")} className="btn btn-secondary w-full">회원가입</button></form><p className="muted mt-4 text-[11px] leading-relaxed">회원가입 시 Supabase 이메일 인증 설정에 따라 인증 메일이 발송될 수 있습니다.</p></div></div>}
  </div>;
}
