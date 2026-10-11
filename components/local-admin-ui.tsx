import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";

import { COLORS, PageHeader, commonStyles } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";

export function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={commonStyles.content} keyboardShouldPersistTaps="handled"><PageHeader title={title} subtitle={subtitle} />{children}</ScrollView></ScreenContainer>;
}

export function AdminCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AdminField({ label, error, style, ...props }: TextInputProps & { label: string; error?: string; style?: object }) {
  return <View style={[styles.fieldWrap, style]}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#8B9792" style={[styles.input, Boolean(error) && styles.inputError]} returnKeyType="done" />{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>;
}

export function AdminButton({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.78} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text></TouchableOpacity>;
}

export function StatTile({ label, value, accent = COLORS.primary }: { label: string; value: string; accent?: string }) {
  return <View style={styles.statTile}><Text style={[styles.statValue, { color: accent }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 26, padding: 18, marginBottom: 14 },
  fieldWrap: { marginBottom: 14 },
  label: { color: COLORS.ink, fontSize: 12, fontWeight: "900", textAlign: "right", marginBottom: 7 },
  input: { minHeight: 54, borderRadius: 21, borderWidth: 1, borderColor: "#F2F1EE", backgroundColor: "#F2F1EE", color: COLORS.ink, paddingHorizontal: 15, fontSize: 14, textAlign: "right", writingDirection: "rtl" },
  inputError: { borderColor: COLORS.danger, backgroundColor: "#FDF4F2" },
  errorText: { color: COLORS.danger, fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 6 },
  button: { minHeight: 56, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 3 },
  buttonSecondary: { backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE" },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  buttonTextSecondary: { color: COLORS.ink },
  disabled: { opacity: 0.45 },
  sectionHeading: { color: COLORS.ink, fontSize: 17, fontWeight: "900", textAlign: "right", marginTop: 29, marginBottom: 11 },
  statTile: { flex: 1, minHeight: 96, borderRadius: 22, backgroundColor: "#FAF9F6", borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  statValue: { fontSize: 19, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 5 },
});

export const adminStyles = styles;
