import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { COLORS, PageHeader, RoundIcon, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { getApiBaseUrl } from "@/constants/oauth";
import { useStaffSession } from "@/lib/staff-session";
import { trpc } from "@/lib/trpc";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const serverLabel = getApiBaseUrl() || "سيرفر غير مضبوط";

function describeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/UNAUTHORIZED|بيانات الدخول/i.test(message)) return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  if (/fetch failed|Network request failed|Failed to fetch/i.test(message)) {
    return `تعذّر الوصول إلى سيرفر الصيدلية على ${serverLabel}. تأكد أن السيرفر يعمل وأن الهاتف على نفس الشبكة.`;
  }
  return message || "تعذّر إكمال الدخول. حاول مرة أخرى.";
}

export default function StaffLoginScreen() {
  const { configured, login, bootstrap } = useStaffSession();
  const status = trpc.staff.status.useQuery(undefined, { retry: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string; displayName?: string }>({});
  const [feedback, setFeedback] = useState<string>();
  const [busy, setBusy] = useState(false);

  const isSetup = configured === false;

  const submit = async () => {
    const nextErrors: typeof errors = {};
    const user = username.trim();
    if (user.length < 3) nextErrors.username = "اسم المستخدم لا يقل عن 3 أحرف.";
    else if (!USERNAME_PATTERN.test(user)) nextErrors.username = "استخدم حروفًا إنجليزية أو أرقامًا أو . _ - فقط.";
    if (password.length < 8) nextErrors.password = "كلمة المرور لا تقل عن 8 أحرف.";
    if (isSetup && displayName.trim().length < 2) nextErrors.displayName = "اكتب اسم المسؤول كما يظهر للصيدلية.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setFeedback(undefined); return; }

    setBusy(true);
    setFeedback(undefined);
    try {
      if (isSetup) await bootstrap({ username: user, password, displayName: displayName.trim() });
      else await login({ username: user, password });
      router.back();
    } catch (error) {
      setFeedback(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.75}>
          <IconSymbol name="chevron.right" size={20} color={COLORS.ink} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <PageHeader
          title={isSetup ? "إنشاء حساب المالك" : "دخول المسؤول"}
          subtitle={isSetup
            ? "لم يُنشأ أي حساب بعد. الحساب الأول يكون مالك الصيدلية ويملك كل الصلاحيات."
            : "هذه الصفحات محمية: إدارة الأفراد، صندوق الإشعارات، وسجل النشاط."}
        />

        <View style={styles.hero}>
          <RoundIcon name={isSetup ? "person.crop.circle.fill" : "lock.fill"} color="#82E3C0" background="#163B34" />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>سيرفر الصيدلية</Text>
            <Text style={styles.heroDetail} numberOfLines={1}>{serverLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => void status.refetch()} disabled={status.isFetching} style={styles.heroAction} activeOpacity={0.8}>
            {status.isFetching ? <ActivityIndicator size="small" color={COLORS.primary} /> : <IconSymbol name="arrow.clockwise" size={17} color={COLORS.primary} />}
          </TouchableOpacity>
        </View>

        {status.isError ? (
          <View style={styles.warnBanner}>
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={COLORS.warning} />
            <Text style={styles.warnText}>السيرفر لا يستجيب الآن. الحسابات مخزّنة في قاعدة بيانات الصيدلية، فبدونه لا يمكن التحقق من كلمة المرور.</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {isSetup ? (
            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.inputLabel}>اسم المسؤول</Text>
              <TextInput
                value={displayName}
                onChangeText={(value) => { setDisplayName(value); setErrors((current) => ({ ...current, displayName: undefined })); }}
                placeholder="مثال: محمد وجيه"
                placeholderTextColor="#8B9792"
                style={[commonStyles.input, Boolean(errors.displayName) && styles.inputError]}
              />
              {errors.displayName ? <Text style={styles.errorText}>{errors.displayName}</Text> : null}
            </View>
          ) : null}

          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.inputLabel}>اسم المستخدم</Text>
            <TextInput
              value={username}
              onChangeText={(value) => { setUsername(value); setErrors((current) => ({ ...current, username: undefined })); }}
              placeholder="pharmacy.owner"
              placeholderTextColor="#8B9792"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[commonStyles.input, Boolean(errors.username) && styles.inputError]}
            />
            {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
          </View>

          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.inputLabel}>كلمة المرور</Text>
            <TextInput
              value={password}
              onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }}
              placeholder="٨ أحرف على الأقل"
              placeholderTextColor="#8B9792"
              secureTextEntry
              autoCapitalize="none"
              style={[commonStyles.input, Boolean(errors.password) && styles.inputError]}
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {feedback ? (
            <View style={styles.errorBanner}>
              <IconSymbol name="exclamationmark.triangle.fill" size={15} color={COLORS.danger} />
              <Text style={styles.errorBannerText}>{feedback}</Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={() => void submit()} disabled={busy} style={[commonStyles.primaryButton, busy && styles.buttonDisabled]} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <IconSymbol name={isSetup ? "plus.circle.fill" : "rectangle.portrait.and.arrow.right"} size={18} color="#FFFFFF" />}
            <Text style={commonStyles.primaryButtonText}>{isSetup ? "إنشاء الحساب والدخول" : "دخول"}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            {isSetup
              ? "احفظ كلمة المرور جيدًا؛ لا يمكن استرجاعها من داخل التطبيق، والمسؤول فقط يقدر يعيد تعيينها بعد ذلك من لوحة الأفراد."
              : "لو نسيت كلمة المرور، يمكن لمسؤول آخر أو مالك الصيدلية إعادة تعيينها من «أفراد الصيدلية»."}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  back: { flexDirection: "row-reverse", alignSelf: "flex-end", alignItems: "center", gap: 3, marginBottom: 10 },
  backText: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
  hero: { flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: COLORS.deep, borderRadius: 22, padding: 15 },
  heroText: { flex: 1, alignItems: "flex-end" },
  heroTitle: { color: "#DDF5EA", fontSize: 11, fontWeight: "900", textAlign: "right" },
  heroDetail: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800", textAlign: "right", marginTop: 3 },
  heroAction: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  warnBanner: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 9, backgroundColor: COLORS.softWarning, borderRadius: 18, padding: 13, marginTop: 12 },
  warnText: { flex: 1, color: "#8E462C", fontSize: 11, lineHeight: 18, textAlign: "right" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginTop: 16 },
  inputError: { borderWidth: 1, borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 10.5, fontWeight: "800", textAlign: "right", marginTop: 6 },
  errorBanner: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, backgroundColor: COLORS.softDanger, borderRadius: 16, padding: 12, marginBottom: 14 },
  errorBannerText: { flex: 1, color: COLORS.danger, fontSize: 11, lineHeight: 18, textAlign: "right" },
  buttonDisabled: { opacity: 0.65 },
  hint: { color: COLORS.muted, fontSize: 10.5, lineHeight: 18, textAlign: "right", marginTop: 13 },
});
