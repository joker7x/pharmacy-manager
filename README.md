# صيدليتي 💊

تطبيق صيدلية يعمل أوفلاين أولًا (Expo / React Native + TypeScript) للبيع، الورديات، الخزينة، النواقص وطلبيات الموردين، مع نسخة احتياطية سحابية كاملة على Supabase.

واجهة عربية RTL بالكامل، والأرقام بتنسيق `ar-EG`.

## المتطلبات

- Node.js 20+ و pnpm
- Expo SDK 54 (تشغيل ويب أو من خلال Expo Go)
- MySQL محلي فقط إذا أردت تشغيل سيرفر الـ API (العاملين/الكتالوج السحابي) — بقية التطبيق يعمل بدون سيرفر

## التشغيل

```bash
pnpm install
cp .env.example .env      # ثم املأ مفاتيح Supabase
pnpm dev                  # سيرفر API على :3000 + Metro ويب على :8081
pnpm dev:metro            # Metro فقط
pnpm check                # tsc --noEmit
pnpm test                 # vitest
```

## فحص الكتالوج الأوفلاين

البحث عن الأصناف لا يعتمد على السيرفر: الملفان `assets/catalog/items.catalog` و `index.catalog` يولَّدان من `data/druglist.csv`:

```bash
pnpm catalog:build
```

## النسخ الاحتياطي السحابي

- الجدول: `public.pharmacy_backups` — أنشئه من `supabase/pharmacy-backups.sql` في Supabase Studio.
- العميل: `lib/cloud-backup.ts` (PostgREST عن طريق `fetch` بدون SDK).
- المزوّد: `lib/pharmacy-context.tsx` — رفع تلقائي كل ٤٥ ثانية بعد أي تغيير، ورفعة فورية لأي تغيير في الخزينة.
- الواجهة: `app/settings.tsx` ← «النسخ الاحتياطي السحابي» (رفع الآن / استرجاع / حذف).

> سياسات RLS في ملف SQL مفتوحة لمفتاح `anon` لأنها أبسط طريقه للتشغيل. قبل الاستخدام الفعلي قيّدها (مفتاح خاص أو توكين صريح في عمود `token`) — التفاصيل موثّقة داخل الملف.

## بناء APK

```bash
npx eas login
# مرة واحدة لكل مشروع: ارفع الأسرار المستخدمة في eas.json
npx eas secret:create --scope project-only --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co"
npx eas secret:create --scope project-only --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
npx eas secret:create --scope project-only --name EXPO_PUBLIC_API_BASE_URL --value "http://192.168.1.20:3000"

npx eas build --platform android --profile preview      # APK
npx eas build --platform android --profile production   # AAB
```

البناء فقط لمعمارية `arm64-v8a` مع ProGuard (حجم APK ≈ ٣٦ ميجابايت).

## هيكل المشروع

| المسار | الدور |
|---|---|
| `app/` | شاشات expo-router (٤ تبويبات + شاشات pushed) |
| `lib/pharmacy-context.tsx` | حالة التطبيق المحلية والمutations كلها |
| `lib/shortage-actions.ts`, `lib/shift-schedule.ts` | قواعد النواقص والورديات (دوال نقية، عليها الاختبارات) |
| `lib/offline-catalog.ts` | قراءة وفهرسة كتالوج الجهاز |
| `components/` | مكوّنات التصميم المشترك + `snackbar.tsx` للتراجع |
| `server/` | tRPC + Drizzle (عاملين، كتالوج، جلسات) |
| `tests/` | vitest |

## الأمان

- `.env` غير متابع في git، ومفاتيح البناء السحابي في EAS Secrets وليس في `eas.json`.
- ورديات مقفولة وتحويلات الخزينة غير قابلة للتعديل بعد القفل.
- شاشة تجميع بيانات الصيدلية (`app/owner-console.tsx`) تظهر لحساب المالك فقط.
