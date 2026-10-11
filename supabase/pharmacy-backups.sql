-- صيدليتي — جدول النسخ الاحتياطية السحابية
-- نفّذه في Supabase Studio ← SQL Editor ← New query ← Run.
-- اسم الجدول لازم يطابق EXPO_PUBLIC_SUPABASE_TABLE في ملف .env (الافتراضي: pharmacy_backups).

create table if not exists public.pharmacy_backups (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  source      text        not null default 'يدوي',   -- يدوي | تلقائي | قبل استرجاع
  device      text,
  app_version text,
  size        integer,                                -- طول الـ JSON بالبايت للعرض فقط
  counts      jsonb,                                  -- ملخص الأصناف/الفواتير/الورديات
  payload     jsonb       not null                    -- النسخة الكاملة من بيانات التطبيق
);

create index if not exists pharmacy_backups_created_at_idx on public.pharmacy_backups (created_at desc);

comment on table public.pharmacy_backups is 'لقطات كاملة لحالة تطبيق صيدليتي (PharmacyState) لأغراض الاسترجاع.';

-- ⚠️ الوصول: التطبيق يتصل بمفتاح anon من غير تسجيل دخول في Supabase،
-- لذا السياسات دي بتسمح لأي حد يحمل الرابط + المفتاح يقرأ ويضيف.
-- لو المشروع فيه بيانات حقيقية لصيدلية، طبّق واحدة من دول قبل الإنتاج:
--   1) أضيف عمود org_hash وسجّل/استعلم بـ filter عليه، والـ policy يتحقق بقيمة سرية.
--   2) أو فعّل Supabase Auth واستخدم مفتاح service_role على السيرفر (tRPC) بدل العميل.
--   3) أو ضع حد شبكة (IP allowlist) / مشروع مخصص للصيدلية لوحدها.
alter table public.pharmacy_backups enable row level security;

drop policy if exists "pharmacy_backups_insert" on public.pharmacy_backups;
create policy "pharmacy_backups_insert" on public.pharmacy_backups
  for insert to anon, authenticated with check (true);

drop policy if exists "pharmacy_backups_select" on public.pharmacy_backups;
create policy "pharmacy_backups_select" on public.pharmacy_backups
  for select to anon, authenticated using (true);

drop policy if exists "pharmacy_backups_delete" on public.pharmacy_backups;
create policy "pharmacy_backups_delete" on public.pharmacy_backups
  for delete to anon, authenticated using (true);

-- للتحقق بعد أول رفع:
-- select id, created_at, source, device, size, counts from public.pharmacy_backups order by created_at desc limit 5;
