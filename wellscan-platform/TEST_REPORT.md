# WellScan pre-deployment test report

Date: 2026-10-26

## Result summary

- Static source/configuration checks: **13/13 passed**.
- ZIP archive integrity: **passed**.
- Dependency installation: **blocked**; npm registry DNS resolution failed (`EAI_AGAIN registry.npmjs.org`).
- Next.js production build: **not run successfully** because dependencies could not be installed.
- Browser/E2E tests: **not run**; there is no running app in this environment.
- Real OCR image recognition: **not verified**; OCR model downloads require network access and actual test label images.
- Live Supabase tests: **not run**; no Supabase project credentials are configured.
- Vercel deployment: **not performed**; no Vercel/Git repository connection or project access is configured.

## Static checks passed

1. `package.json` parses as valid JSON.
2. OCR selector is wired to the selected Tesseract language.
3. 36 OCR language/model options are present in the UI.
4. Korean/English analysis output selection is wired to the API.
5. Server-side analysis profile allowlist exists.
6. Analysis API requires an authenticated user token.
7. Analysis input is limited to 20,000 characters.
8. OpenAI API key is referenced server-side only.
9. Admin API checks `profiles.role` and rejects non-admin users.
10. SQL contains admin-only RLS policies for cross-user reads and dictionary writes.
11. Normal users' scan read policy is scoped to `auth.uid()`.
12. No service-role key reference exists in client source files.
13. README states deployment has not occurred and documents known limitations.

## Before production deployment

- Install dependencies in a network-enabled environment and run `npm run build`; resolve all compiler/build errors.
- Configure Supabase URL and anon key, OpenAI API key, and optional model name in local/Vercel environment settings. Do not paste secret values into public source files.
- Apply `supabase/schema.sql` in the intended Supabase project and promote the intended admin account only after sign-up.
- Verify normal-user versus admin access against a live Supabase project, including cross-user data denial.
- Run real OCR tests on representative product labels for every target language; inspect OCR output before trusting analysis.
- Add distributed rate limiting, OpenAI spending limits, monitoring/audit logging, privacy policy/consent, retention/deletion controls, and reviewed ingredient/regulatory data before public launch.
- Deploy to Vercel, then smoke-test sign-up/login, OCR, analysis, history, normal-user `/admin` denial, and admin dashboard on the deployed URL.

## Important product limitation

The AI currently reasons from the supplied label text and model knowledge. It does not query a verified regulatory/ingredient database by default and must not be represented as a definitive medical, allergy-safety, or country-specific compliance decision.
