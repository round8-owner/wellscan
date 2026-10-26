# WellScan — multilingual food ingredient analysis MVP

Next.js + Supabase + Vercel application based on the original WellScan HTML prototype.

## What is included

- Responsive Korean/English UI
- Camera/photo upload and image preview
- Tesseract.js OCR language selector for English/Korean, Thai, Japanese, Simplified/Traditional Chinese, Vietnamese, Spanish, French, German, Indonesian, Malay, Arabic, Bengali, Bulgarian, Catalan, Czech, Danish, Greek, Persian, Finnish, Hebrew, Hindi, Croatian, Hungarian, Italian, Dutch, Norwegian, Polish, Portuguese, Romanian, Russian, Swedish, Tamil, Telugu, Turkish and Ukrainian (trained-data downloads require network access)
- AI-powered ingredient normalization and profile-specific explanations through OpenAI API
- Output language selection: Korean or English
- Profiles: general, pregnancy-related review, diabetes/blood-sugar awareness, child, nutrition, allergy
- Supabase Auth and saved scan history
- Admin dashboard at `/admin`
- Server-side admin role check
- Ingredient dictionary with Korean/English canonical names and aliases
- Supabase SQL schema and row-level security policies

## Important limitations

1. The app is an MVP, not a validated medical device or clinical decision tool.
2. OCR language can be selected from the UI. Tesseract downloads language trained-data on demand, so the first scan for a language requires network/CDN access. Recognition quality must be validated on real packaging, especially mixed-language labels and non-Latin scripts. AI normalization supports multilingual source text but does not guarantee OCR correctness.
3. The AI model does not consult a verified external regulatory/ingredient database by default. It must not be treated as an authoritative safety determination. Add reviewed sources and clinical/regulatory review before public launch.
4. The admin API checks `profiles.role` and uses the user access token. The SQL schema includes admin-only RLS policies for cross-user dashboards and dictionary edits. Do not add a Supabase service-role key to client code. Before production, add distributed rate limiting, audit logging, monitoring, and cost controls.
5. No actual deployment has been performed from this repository. Supabase and Vercel require your accounts, keys, and deployment approval.

## 1. Run locally

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Fill `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-4.1-mini`)

Open http://localhost:3000.

## 2. Set up Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication settings, configure your allowed redirect URLs and email confirmation settings.
4. Create an account through the app.
5. In SQL Editor, promote your account to admin:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL';
```

6. Use `/admin` to manage ingredient dictionary entries and inspect scan/user lists.

The SQL trigger creates a `profiles` row for each new auth user. Never allow users to set their own role to `admin`.

## 3. Deploy to Vercel

1. Push this folder to a private GitHub repository.
2. In Vercel, import the repository.
3. Add the same environment variables in Project Settings → Environment Variables.
4. Deploy. If you add a custom domain, add it to Supabase Auth's Site URL and redirect URL allowlist.
5. Test login, OCR, analysis, history, and `/admin` using both a regular user and the admin account.

## 4. International OCR roadmap

The current OCR worker is configured for `eng+kor`. To add a language, verify that a compatible Tesseract trained-data package is available and validate each supported model on real packaging. For production label recognition across Thai, Japanese, Chinese, Vietnamese, etc., compare OCR quality; a managed OCR service may be more robust. Keep original text for audit and user correction.

## 5. Production readiness checklist

- Add rate limiting and abuse controls to `/api/analyze`.
- Set cost limits and request quotas for the AI provider.
- Add image retention/deletion policy; current app does not upload photos to Supabase Storage.
- Add consent and privacy policy before storing personal health profile data.
- Use a reviewed ingredient/regulatory database with source URLs and country-specific rules.
- Add human review workflow and audit trail for dictionary edits.
- Test adversarial OCR text, malformed labels, allergies, dose-dependent ingredients, and uncertain translations.
- Run `npm run build` and resolve any environment/build issues before launch.

## 비용 최소화 구성 (2026-10-26)

- 신규 Supabase 프로젝트는 생성하지 않습니다. 기존 `LYPE` 프로젝트를 재사용하며, 기존 LYPE 테이블은 수정하지 않고 `wellscan_profiles`, `wellscan_scans`, `wellscan_ingredient_dictionary` 전용 테이블을 사용합니다.
- 세 WellScan 테이블은 RLS가 활성화되어 있습니다. 사용자별 스캔 기록은 소유자 기준으로 제한되며, 관리자 기능은 `wellscan_profiles.role = 'admin'`을 확인합니다.
- Vercel 프로젝트 `wellscan-platform`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_MODEL` 환경변수를 설정했습니다. `OPENAI_API_KEY`는 사용자가 Vercel Dashboard에서 직접 설정해야 합니다.
- 기존 Supabase 프로젝트를 재사용해 신규 프로젝트의 별도 월 $10 비용은 피했지만, 기존 프로젝트의 요금·사용량이 무료임을 보장하는 것은 아닙니다.
- Vercel의 실제 소스 배포/빌드와 OpenAI 분석의 엔드투엔드 테스트는 아직 완료되지 않았습니다.
