import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Badge, COLORS, PageHeader, RoundIcon, commonStyles } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { PERMISSION_LABELS, ROLE_LABELS, STAFF_PERMISSIONS, STATUS_LABELS, type StaffPermission, type StaffRole, type StaffStatus } from "@/lib/staff-access";
import { useStaffSession } from "@/lib/staff-session";
import { trpc } from "@/lib/trpc";

type Tab = "users" | "sessions" | "activity" | "messages";
type Stamp = Date | string;
type Profile = { userId: number; displayName: string; username: string; role: StaffRole; status: StaffStatus; permissions: StaffPermission[]; frozenUntil?: Stamp | null };
type SessionRow = { id: string; displayName: string; deviceName: string; deviceModel?: string | null; devicePlatform: string; osVersion?: string | null; networkAddress?: string | null; lastActiveAt: Stamp; signedOutAt?: Stamp | null };
type AuditRow = { id: number; detail: string; actorName: string; action: string; createdAt: Stamp; deviceName?: string | null };
type Feedback = { tone: "error" | "success"; text: string };

const toDate = (value: Stamp) => (value instanceof Date ? value : new Date(value));

const TABS: { id: Tab; label: string }[] = [{ id: "users", label: "الأفراد" }, { id: "sessions", label: "الجلسات" }, { id: "activity", label: "النشاط" }, { id: "messages", label: "إشعار" }];
const ROLES: StaffRole[] = ["cashier", "pharmacist", "viewer", "owner"];

export default function StaffAdminScreen() {
  const { staff: current, can } = useStaffSession();
  const [tab, setTab] = useState<Tab>("users");
  const [expandedId, setExpandedId] = useState<number>();
  const [feedback, setFeedback] = useState<Feedback>();
  const isAllowed = Boolean(current && can("staff.manage"));
  const staffList = trpc.staff.list.useQuery(undefined, { enabled: isAllowed, retry: false });
  const sessions = trpc.staff.sessions.useQuery(undefined, { enabled: tab === "sessions" && isAllowed, retry: false });
  const audits = trpc.staff.audits.useQuery(undefined, { enabled: tab === "activity" && isAllowed, retry: false });
  const refreshUsers = () => { void staffList.refetch(); void sessions.refetch(); };
  const create = trpc.staff.create.useMutation({ onSuccess: () => { refreshUsers(); setFeedback({ tone: "success", text: "أُنشئ الحساب الجديد ويمكنه الدخول الآن." }); }, onError: (error) => setFeedback({ tone: "error", text: `تعذّر إنشاء الحساب: ${error.message}` }) });
  const update = trpc.staff.update.useMutation({ onSuccess: () => { refreshUsers(); setFeedback({ tone: "success", text: "حُفظت التعديلات على الحساب." }); }, onError: (error) => setFeedback({ tone: "error", text: `تعذّر تحديث الحساب: ${error.message}` }) });
  const resetPassword = trpc.staff.resetPassword.useMutation({ onSuccess: () => setFeedback({ tone: "success", text: "تم تعيين كلمة المرور الجديدة للحساب." }), onError: (error) => setFeedback({ tone: "error", text: `تعذّر إعادة تعيين كلمة المرور: ${error.message}` }) });
  const sendNotification = trpc.staff.sendNotification.useMutation({ onSuccess: (result) => setFeedback({ tone: "success", text: `حُفظ الإشعار في صندوق ${result.recipients} مستخدم، وقبلت خدمة الهاتف ${result.push.accepted} طلب إرسال${result.push.failed ? ` مع تعذر ${result.push.failed}.` : "."}` }), onError: (error) => setFeedback({ tone: "error", text: `تعذّر إرسال الإشعار: ${error.message}` }) });

  if (!current) {
    return <ScreenContainer className="flex-1"><View style={styles.denied}><RoundIcon name="person.crop.circle.fill" color={COLORS.muted} background="#EEF3F1" /><Text style={styles.deniedTitle}>تحتاج تسجيل دخول المسؤول</Text><Text style={styles.deniedText}>هذه صفحة إدارة أفراد الصيدلية. سجّل دخولك بحساب يملك صلاحية الإدارة لعرض الحسابات والجلسات.</Text><TouchableOpacity onPress={() => router.push("/login")} style={commonStyles.primaryButton} activeOpacity={0.85}><IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#FFFFFF" /><Text style={commonStyles.primaryButtonText}>تسجيل الدخول</Text></TouchableOpacity></View></ScreenContainer>;
  }
  if (!isAllowed) {
    return <ScreenContainer className="flex-1"><View style={styles.denied}><RoundIcon name="lock.fill" color={COLORS.muted} background="#EEF3F1" /><Text style={styles.deniedTitle}>هذه الصفحة للمسؤول فقط</Text><Text style={styles.deniedText}>حساب «{current.displayName}» لا يملك صلاحية إدارة أفراد الصيدلية.</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PageHeader title="إدارة أفراد الصيدلية" subtitle="الحسابات والصلاحيات والجلسات وسجل النشاط في مكان واحد" />
        {feedback ? <View style={[styles.notice, feedback.tone === "error" ? styles.noticeError : styles.noticeSuccess]}><IconSymbol name={feedback.tone === "error" ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={16} color={feedback.tone === "error" ? COLORS.danger : COLORS.primary} /><Text style={[styles.noticeText, feedback.tone === "error" ? styles.noticeTextError : styles.noticeTextSuccess]}>{feedback.text}</Text><TouchableOpacity onPress={() => setFeedback(undefined)} style={styles.noticeClose} activeOpacity={0.7}><IconSymbol name="xmark" size={13} color={COLORS.muted} /></TouchableOpacity></View> : null}
        <View style={styles.summary}><View style={styles.summaryText}><Text style={styles.summaryLabel}>مسؤول الدخول الحالي</Text><Text style={styles.summaryName}>{current.displayName}</Text></View><Badge label={ROLE_LABELS[current.role]} tone="success" /></View>
        <View style={styles.tabs}>{TABS.map((item) => <TouchableOpacity key={item.id} onPress={() => { setTab(item.id); setFeedback(undefined); }} style={[styles.tab, tab === item.id && styles.tabActive]} activeOpacity={0.8}><Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
        {staffList.isError ? <View style={styles.backendNote}><IconSymbol name="exclamationmark.triangle.fill" size={17} color={COLORS.warning} /><Text style={styles.backendNoteText}>حسابات الأفراد محفوظة على سيرفر الصيدلية وهو غير متاح الآن. شغّل الخادم ثم أعد فتح الصفحة لإدارة الحسابات.</Text></View> : null}
        {tab === "users" ? <UsersPanel staff={(staffList.data ?? []) as Profile[]} loading={staffList.isLoading} expandedId={expandedId} setExpandedId={setExpandedId} create={create} update={update} resetPassword={resetPassword} currentUserId={current.userId} /> : null}
        {tab === "sessions" ? <SessionsPanel sessions={(sessions.data ?? []) as SessionRow[]} loading={sessions.isLoading} /> : null}
        {tab === "activity" ? <AuditPanel audits={(audits.data ?? []) as AuditRow[]} loading={audits.isLoading} /> : null}
        {tab === "messages" ? <MessagePanel staff={(staffList.data ?? []) as Profile[]} send={sendNotification} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function UsersPanel({ staff, loading, expandedId, setExpandedId, create, update, resetPassword, currentUserId }: { staff: Profile[]; loading: boolean; expandedId?: number; setExpandedId: (id?: number) => void; create: ReturnType<typeof trpc.staff.create.useMutation>; update: ReturnType<typeof trpc.staff.update.useMutation>; resetPassword: ReturnType<typeof trpc.staff.resetPassword.useMutation>; currentUserId: number }) {
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("cashier");
  const [errors, setErrors] = useState<{ name?: string; username?: string; password?: string }>({});

  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!newName.trim()) nextErrors.name = "اكتب الاسم الظاهر للفرد.";
    if (!newUsername.trim()) nextErrors.username = "اكتب اسم المستخدم للدخول.";
    if (newPassword.length < 8) nextErrors.password = "كلمة المرور يجب ألا تقل عن 8 أحرف.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    create.mutate({ displayName: newName.trim(), username: newUsername.trim(), password: newPassword, role: newRole });
    setNewName(""); setNewUsername(""); setNewPassword(""); setNewRole("cashier");
  };

  return <View>
    <Text style={styles.sectionHeading}>إضافة فرد جديد</Text>
    <View style={styles.createCard}>
      <Field label="الاسم الظاهر" value={newName} onChangeText={(value) => { setNewName(value); setErrors((c) => ({ ...c, name: undefined })); }} placeholder="مثال: محمد سعيد" error={errors.name} />
      <Field label="اسم المستخدم" value={newUsername} onChangeText={(value) => { setNewUsername(value); setErrors((c) => ({ ...c, username: undefined })); }} placeholder="mohamed.cashier" autoCapitalize="none" error={errors.username} />
      <Field label="كلمة المرور" value={newPassword} onChangeText={(value) => { setNewPassword(value); setErrors((c) => ({ ...c, password: undefined })); }} placeholder="8 أحرف على الأقل" secureTextEntry error={errors.password} />
      <RoleSelector value={newRole} onChange={setNewRole} />
      <PrimaryButton label={create.isPending ? "جارٍ إنشاء الحساب…" : "إنشاء حساب العامل"} onPress={submit} disabled={create.isPending} />
    </View>
    <Text style={styles.sectionHeading}>أفراد الصيدلية · {staff.length.toLocaleString("ar-EG")}</Text>
    {loading ? <Text style={styles.loading}>جارٍ تحميل الحسابات…</Text> : staff.length ? <View style={styles.listCard}>{staff.map((item, index) => {
      const frozenUntil = item.frozenUntil ? toDate(item.frozenUntil) : undefined;
      const freezeExpired = item.status === "frozen" && frozenUntil ? frozenUntil.getTime() <= Date.now() : false;
      return <View key={item.userId} style={index < staff.length - 1 ? styles.listBorder : undefined}>
        <TouchableOpacity onPress={() => setExpandedId(expandedId === item.userId ? undefined : item.userId)} style={styles.staffRow} activeOpacity={0.76}>
          <View style={[styles.statusDot, item.status === "active" ? styles.dotActive : item.status === "frozen" && !freezeExpired ? styles.dotFrozen : styles.dotDisabled]} />
          <View style={styles.staffInfo}><Text style={styles.staffName}>{item.displayName}</Text><Text style={styles.staffSub}>{item.username} · {ROLE_LABELS[item.role]}</Text></View>
          <Text style={styles.statusLabel}>{freezeExpired ? "انتهى التجميد" : STATUS_LABELS[item.status]}</Text>
          <IconSymbol name={expandedId === item.userId ? "chevron.down" : "chevron.left"} size={16} color={COLORS.muted} />
        </TouchableOpacity>
        {expandedId === item.userId ? <StaffControls item={item} update={update} resetPassword={resetPassword} currentUserId={currentUserId} /> : null}
      </View>;
    })}</View> : <View style={styles.listCard}><Text style={styles.emptyText}>لا توجد حسابات أفراد على السيرفر بعد.</Text></View>}
  </View>;
}

function StaffControls({ item, update, resetPassword, currentUserId }: { item: Profile; update: ReturnType<typeof trpc.staff.update.useMutation>; resetPassword: ReturnType<typeof trpc.staff.resetPassword.useMutation>; currentUserId: number }) {
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [permissions, setPermissions] = useState<StaffPermission[]>(item.permissions);
  const [freezePreset, setFreezePreset] = useState<"day" | "week" | "custom">("day");
  const [customHours, setCustomHours] = useState("24");
  const [customError, setCustomError] = useState<string>();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const isSelf = item.userId === currentUserId;
  const savePermissions = () => update.mutate({ userId: item.userId, permissions });
  const nextRole = ROLES[(ROLES.indexOf(item.role) + 1) % ROLES.length];
  const frozenUntil = item.frozenUntil ? toDate(item.frozenUntil) : undefined;
  const freezeHours = freezePreset === "day" ? 24 : freezePreset === "week" ? 24 * 7 : Number(customHours);
  const freezeLabel = freezePreset === "day" ? "تجميد يوم" : freezePreset === "week" ? "تجميد أسبوع" : `تجميد ${Number.isFinite(freezeHours) ? freezeHours : 0} ساعة`;
  const freeze = () => {
    if (!Number.isFinite(freezeHours) || freezeHours < 1 || freezeHours > 24 * 365) return setCustomError("أدخل مدة من ساعة واحدة إلى 365 يومًا.");
    setCustomError(undefined);
    update.mutate({ userId: item.userId, status: "frozen", frozenUntil: new Date(Date.now() + freezeHours * 60 * 60 * 1000) });
  };
  const savePassword = () => {
    if (newPassword.length < 8) return setPasswordError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
    setPasswordError(undefined);
    resetPassword.mutate({ userId: item.userId, password: newPassword });
    setNewPassword("");
  };
  return <View style={styles.controls}>
    <Text style={styles.controlsTitle}>تحكم في حساب {item.displayName}</Text>
    <View style={styles.actionRow}>
      <Chip label={`الدور: ${ROLE_LABELS[item.role]}`} onPress={() => update.mutate({ userId: item.userId, role: nextRole })} />
      <Chip label={item.status === "active" ? freezeLabel : "تفعيل الحساب"} onPress={() => item.status === "active" ? freeze() : update.mutate({ userId: item.userId, status: "active", frozenUntil: null })} />
      <Chip label="تعطيل" danger disabled={isSelf} onPress={() => setConfirmDeactivate(true)} />
    </View>
    {isSelf ? <Text style={styles.selfNote}>هذا حسابك الحالي؛ لا يمكن تعطيله من داخل التطبيق.</Text> : null}
    {item.status === "active" ? <View style={styles.freezePicker}>
      <Text style={styles.permissionsTitle}>مدة التجميد · يعود الحساب تلقائيًا عند انتهائها</Text>
      <View style={styles.targetRow}><Chip label="يوم" selected={freezePreset === "day"} onPress={() => setFreezePreset("day")} /><Chip label="أسبوع" selected={freezePreset === "week"} onPress={() => setFreezePreset("week")} /><Chip label="مدة مخصصة" selected={freezePreset === "custom"} onPress={() => setFreezePreset("custom")} /></View>
      {freezePreset === "custom" ? <Field label="عدد الساعات" value={customHours} onChangeText={(value) => { setCustomHours(value.replace(/[^0-9]/g, "")); setCustomError(undefined); }} placeholder="مثال: 48" keyboardType="number-pad" error={customError} /> : null}
    </View> : frozenUntil ? <Text style={styles.freezeUntil}>{frozenUntil.getTime() > Date.now() ? `مجمّد حتى ${frozenUntil.toLocaleString("ar-EG")} — يعود تلقائيًا بعدها.` : "انتهت مدة التجميد؛ فعّل الحساب ليعود للدخول."}</Text> : null}
    <Text style={styles.permissionsTitle}>الصلاحيات الدقيقة</Text>
    <View style={styles.permissionGrid}>{STAFF_PERMISSIONS.map((permission) => <Chip key={permission} label={PERMISSION_LABELS[permission]} selected={permissions.includes(permission)} onPress={() => setPermissions(permissions.includes(permission) ? permissions.filter((value) => value !== permission) : [...permissions, permission])} />)}</View>
    <SecondaryButton label="حفظ الصلاحيات" onPress={savePermissions} disabled={update.isPending} />
    <Field label="إعادة تعيين كلمة المرور" value={newPassword} onChangeText={(value) => { setNewPassword(value); setPasswordError(undefined); }} placeholder="كلمة مرور جديدة (8 أحرف)" secureTextEntry error={passwordError} />
    <SecondaryButton label="حفظ كلمة المرور الجديدة" onPress={savePassword} disabled={resetPassword.isPending} />
    {confirmDeactivate ? <View style={styles.confirmBox}><Text style={styles.confirmText}>سيُمنع «{item.displayName}» من الدخول حتى تعيد تفعيل الحساب يدويًا.</Text><View style={styles.targetRow}><Chip label="إلغاء" onPress={() => setConfirmDeactivate(false)} /><Chip label="تأكيد التعطيل" danger onPress={() => { setConfirmDeactivate(false); update.mutate({ userId: item.userId, status: "disabled" }); }} /></View></View> : null}
  </View>;
}

function SessionsPanel({ sessions, loading }: { sessions: SessionRow[]; loading: boolean }) {
  return <View><Text style={styles.sectionHeading}>آخر الجلسات</Text>{loading ? <Text style={styles.loading}>جارٍ تحميل الجلسات…</Text> : <View style={styles.listCard}>{sessions.length ? sessions.map((item, index) => <View key={item.id} style={[styles.sessionRow, index < sessions.length - 1 && styles.listBorder]}><View style={styles.staffInfo}><Text style={styles.staffName}>{item.displayName}</Text><Text style={styles.staffSub}>{item.deviceName} · {item.deviceModel ?? item.devicePlatform}</Text><Text style={styles.mutedDetail}>{item.devicePlatform} {item.osVersion ?? ""} · {item.networkAddress ?? "شبكة غير متاحة"}</Text><Text style={styles.mutedDetail}>آخر نشاط {toDate(item.lastActiveAt).toLocaleString("ar-EG")}</Text></View><Badge label={item.signedOutAt ? "منتهية" : "نشطة"} tone={item.signedOutAt ? "neutral" : "success"} /></View>) : <Text style={styles.emptyText}>لا توجد جلسات مسجلة.</Text>}</View>}</View>;
}

function AuditPanel({ audits, loading }: { audits: AuditRow[]; loading: boolean }) {
  return <View><Text style={styles.sectionHeading}>سجل العمليات</Text>{loading ? <Text style={styles.loading}>جارٍ تحميل سجل النشاط…</Text> : <View style={styles.listCard}>{audits.length ? audits.map((item, index) => <View key={item.id} style={[styles.auditRow, index < audits.length - 1 && styles.listBorder]}><View style={styles.staffInfo}><Text style={styles.staffName}>{item.detail}</Text><Text style={styles.staffSub}>{item.actorName} · {item.action}</Text><Text style={styles.mutedDetail}>{toDate(item.createdAt).toLocaleString("ar-EG")} {item.deviceName ? `· ${item.deviceName}` : ""}</Text></View></View>) : <Text style={styles.emptyText}>لا توجد عمليات مسجلة بعد.</Text>}</View>}</View>;
}

function MessagePanel({ staff, send }: { staff: Profile[]; send: ReturnType<typeof trpc.staff.sendNotification.useMutation> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "role" | "user">("all");
  const [role, setRole] = useState<StaffRole>("pharmacist");
  const [userId, setUserId] = useState<number>();
  const [errors, setErrors] = useState<{ title?: string; body?: string; target?: string }>({});
  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = "اكتب عنوان الإشعار.";
    if (!body.trim()) nextErrors.body = "اكتب نص الرسالة.";
    if (target === "user" && !userId) nextErrors.target = "اختر فردًا لإرسال الإشعار إليه.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    send.mutate({ title: title.trim(), body: body.trim(), target: { type: target, role: target === "role" ? role : undefined, userId: target === "user" ? userId : undefined } });
    setTitle(""); setBody("");
  };
  return <View>
    <Text style={styles.sectionHeading}>إرسال إشعار داخل التطبيق</Text>
    <View style={styles.createCard}>
      <Field label="عنوان الإشعار" value={title} onChangeText={(value) => { setTitle(value); setErrors((c) => ({ ...c, title: undefined })); }} placeholder="مثال: اجتماع قصير" error={errors.title} />
      <Field label="نص الرسالة" value={body} onChangeText={(value) => { setBody(value); setErrors((c) => ({ ...c, body: undefined })); }} placeholder="اكتب الرسالة التي ستظهر في صندوق الإشعارات" multiline error={errors.body} />
      <Text style={styles.inputLabel}>المستلمون</Text>
      <View style={styles.targetRow}>{(["all", "role", "user"] as const).map((value) => <Chip key={value} label={value === "all" ? "الجميع" : value === "role" ? "دور محدد" : "فرد محدد"} selected={target === value} onPress={() => { setTarget(value); setErrors((c) => ({ ...c, target: undefined })); }} />)}</View>
      {target === "role" ? <RoleSelector value={role} onChange={setRole} /> : null}
      {target === "user" ? <View style={styles.targetGrid}>{staff.map((item) => <Chip key={item.userId} label={item.displayName} selected={userId === item.userId} onPress={() => { setUserId(item.userId); setErrors((c) => ({ ...c, target: undefined })); }} />)}</View> : null}
      {errors.target ? <Text style={styles.fieldError}>{errors.target}</Text> : null}
      <PrimaryButton label={send.isPending ? "جارٍ الإرسال…" : "إرسال الإشعار"} onPress={submit} disabled={send.isPending} />
    </View>
    <Text style={styles.inlineNote}>تصل الرسالة فورًا إلى صندوق الإشعارات داخل التطبيق. لا تتطلب هذه المرحلة إذن إشعارات الهاتف.</Text>
  </View>;
}

function RoleSelector({ value, onChange }: { value: StaffRole; onChange: (value: StaffRole) => void }) { return <View style={styles.roleWrap}><Text style={styles.inputLabel}>الدور</Text><View style={styles.targetGrid}>{ROLES.map((role) => <Chip key={role} label={ROLE_LABELS[role]} selected={value === role} onPress={() => onChange(role)} />)}</View></View>; }

function Field({ error, label, ...props }: { label: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.inputWrap}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} style={[styles.input, Boolean(error) && styles.inputErrorBorder, props.multiline && styles.textArea]} placeholderTextColor="#96A19C" textAlign="right" returnKeyType="done" />{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <TouchableOpacity onPress={onPress} disabled={disabled} style={[commonStyles.primaryButton, disabled && styles.buttonDisabled]} activeOpacity={0.8}><Text style={commonStyles.primaryButtonText}>{label}</Text></TouchableOpacity>; }
function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.buttonSecondary, disabled && styles.buttonDisabled]} activeOpacity={0.8}><Text style={styles.buttonSecondaryText}>{label}</Text></TouchableOpacity>; }
function Chip({ label, onPress, danger, disabled, selected }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean; selected?: boolean }) { return <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.chip, danger && styles.chipDanger, selected && styles.chipSelected, disabled && styles.buttonDisabled]} activeOpacity={0.76}><Text style={[styles.chipText, danger && styles.chipTextDanger, selected && styles.chipTextSelected]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  denied: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 10 },
  deniedTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "900", textAlign: "center" },
  deniedText: { color: COLORS.muted, fontSize: 12, textAlign: "center", lineHeight: 20 },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 17, paddingHorizontal: 13, paddingVertical: 11, marginTop: 16 },
  noticeError: { backgroundColor: COLORS.softDanger },
  noticeSuccess: { backgroundColor: COLORS.mint },
  noticeText: { flex: 1, fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  noticeTextError: { color: COLORS.danger },
  noticeTextSuccess: { color: COLORS.primary },
  noticeClose: { width: 25, height: 25, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  summary: { backgroundColor: COLORS.deep, borderRadius: 22, padding: 17, marginTop: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  summaryText: { flex: 1, alignItems: "flex-end" },
  summaryLabel: { color: "#BDE5D4", fontSize: 10, fontWeight: "800", textAlign: "right" },
  summaryName: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 4, textAlign: "right" },
  tabs: { marginTop: 17, flexDirection: "row-reverse", gap: 6 },
  tab: { flex: 1, minHeight: 39, borderRadius: 12, backgroundColor: "#F3F2EF", alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.muted, fontSize: 10, fontWeight: "900" },
  tabTextActive: { color: "#FFFFFF" },
  backendNote: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: COLORS.softWarning, borderRadius: 17, padding: 13, marginTop: 16 },
  backendNoteText: { flex: 1, color: "#8E462C", fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  sectionHeading: { color: COLORS.ink, fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 24, marginBottom: 9 },
  createCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  inputWrap: { marginBottom: 11 },
  inputLabel: { color: COLORS.ink, fontSize: 11, fontWeight: "900", textAlign: "right", marginBottom: 6 },
  input: { minHeight: 47, borderRadius: 14, backgroundColor: "#F4F3F0", color: COLORS.ink, paddingHorizontal: 13, fontSize: 13, writingDirection: "rtl" },
  inputErrorBorder: { borderWidth: 1, borderColor: COLORS.danger, backgroundColor: "#FDF4F2" },
  fieldError: { color: COLORS.danger, fontSize: 10, fontWeight: "800", textAlign: "right", marginTop: 5 },
  textArea: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  roleWrap: { marginBottom: 13 },
  targetGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  targetRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 13 },
  buttonSecondary: { minHeight: 46, borderRadius: 15, backgroundColor: "#E8F8F1", alignItems: "center", justifyContent: "center", paddingHorizontal: 15, marginTop: 6, marginBottom: 12 },
  buttonSecondaryText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  buttonDisabled: { opacity: 0.45 },
  chip: { minHeight: 33, backgroundColor: "#F3F2EF", borderRadius: 10, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: "#DDF5EA", borderWidth: 1, borderColor: COLORS.primary },
  chipText: { color: COLORS.ink, fontSize: 10, fontWeight: "900" },
  chipTextSelected: { color: COLORS.primary },
  chipDanger: { backgroundColor: "#FFF0ED" },
  chipTextDanger: { color: COLORS.danger },
  listCard: { backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13 },
  listBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  staffRow: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: COLORS.success },
  dotFrozen: { backgroundColor: COLORS.warning },
  dotDisabled: { backgroundColor: COLORS.danger },
  staffInfo: { flex: 1, alignItems: "flex-end" },
  staffName: { color: COLORS.ink, fontSize: 12, fontWeight: "900", textAlign: "right" },
  staffSub: { color: COLORS.muted, fontSize: 10, marginTop: 3, textAlign: "right" },
  statusLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900" },
  loading: { color: COLORS.muted, fontSize: 12, textAlign: "right", paddingVertical: 14 },
  emptyText: { color: COLORS.muted, fontSize: 12, textAlign: "right", paddingVertical: 16 },
  controls: { backgroundColor: "#F7FAF8", padding: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  controlsTitle: { color: COLORS.ink, fontSize: 11, fontWeight: "900", textAlign: "right", marginBottom: 9 },
  actionRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 13 },
  selfNote: { color: COLORS.muted, fontSize: 10, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  freezePicker: { marginBottom: 4 },
  freezeUntil: { color: COLORS.warning, fontSize: 10, fontWeight: "800", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  permissionsTitle: { color: COLORS.ink, fontSize: 11, fontWeight: "900", textAlign: "right", marginBottom: 8 },
  permissionGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  confirmBox: { backgroundColor: COLORS.softDanger, borderRadius: 16, padding: 13, marginTop: 6 },
  confirmText: { color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", lineHeight: 18, marginBottom: 10 },
  sessionRow: { minHeight: 78, flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingVertical: 10 },
  auditRow: { minHeight: 68, flexDirection: "row-reverse", alignItems: "center", paddingVertical: 10 },
  mutedDetail: { color: COLORS.muted, fontSize: 9, marginTop: 3, textAlign: "right" },
  inlineNote: { color: COLORS.muted, fontSize: 10, textAlign: "right", lineHeight: 18, marginTop: 12 },
});
