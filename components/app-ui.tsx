import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";

export const COLORS = {
  primary: "#1FA47A",
  deep: "#0D2420",
  mint: "#E5F5EF",
  background: "#F7F7F5",
  surface: "#FFFFFF",
  ink: "#0D2420",
  muted: "#7A817E",
  border: "#E9E9E5",
  success: "#1FA47A",
  warning: "#E35B2D",
  danger: "#C64536",
  softWarning: "#FDE5D8",
  softDanger: "#FCE8E2",
  softBlue: "#DFF4F1",
};

export function ReferenceTopBar({ onAdd, onMenu }: { onAdd?: () => void; onMenu?: () => void }) {
  return <View style={styles.referenceTopBar}><TouchableOpacity onPress={onMenu} style={styles.topIconButton} activeOpacity={0.7}><IconSymbol name="line.3.horizontal" size={27} color={COLORS.ink} /></TouchableOpacity><View style={styles.topActions}><TouchableOpacity onPress={onAdd} style={styles.topIconButton} activeOpacity={0.7}><IconSymbol name="plus.circle.fill" size={29} color={COLORS.ink} /></TouchableOpacity><TouchableOpacity style={styles.topIconButton} activeOpacity={0.7}><IconSymbol name="ellipsis.circle.fill" size={27} color={COLORS.ink} /></TouchableOpacity></View></View>;
}

export function PageHeader({ title, subtitle, action, onActionPress }: { title: string; subtitle?: string; action?: string; onActionPress?: () => void }) {
  return <View style={styles.header}><View style={styles.headerText}><Text style={styles.pageTitle}>{title}</Text>{subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}</View>{action && onActionPress ? <TouchableOpacity onPress={onActionPress} style={styles.headerAction} activeOpacity={0.8}><Text style={styles.headerActionText}>{action}</Text><IconSymbol name="plus.circle.fill" size={18} color={COLORS.primary} /></TouchableOpacity> : null}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle>; glass?: boolean }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onActionPress }: { title: string; action?: string; onActionPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onActionPress ? <TouchableOpacity onPress={onActionPress} activeOpacity={0.7}><Text style={styles.sectionAction}>{action}</Text></TouchableOpacity> : null}</View>;
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const stylesByTone = { neutral: { backgroundColor: COLORS.mint, color: COLORS.primary }, success: { backgroundColor: COLORS.mint, color: COLORS.primary }, warning: { backgroundColor: COLORS.softWarning, color: COLORS.warning }, danger: { backgroundColor: COLORS.softDanger, color: COLORS.danger } };
  const toneStyle = stylesByTone[tone];
  return <Text style={[styles.badge, { backgroundColor: toneStyle.backgroundColor, color: toneStyle.color }]}>{label}</Text>;
}

export function RoundIcon({ name, color = COLORS.primary, background = COLORS.mint }: { name: Parameters<typeof IconSymbol>[0]["name"]; color?: string; background?: string }) {
  return <View style={[styles.roundIcon, { backgroundColor: background }]}><IconSymbol name={name} size={22} color={color} /></View>;
}

export function PharmacyMark({ inverse = false, size = "regular" }: { inverse?: boolean; size?: "small" | "regular" }) {
  const compact = size === "small";
  return <View style={[styles.pharmacyMark, compact && styles.pharmacyMarkSmall, { backgroundColor: inverse ? "#163B34" : COLORS.mint }]}><View style={styles.markCross}><View style={[styles.markCrossVertical, { backgroundColor: inverse ? "#FFFFFF" : COLORS.primary }]} /><View style={[styles.markCrossHorizontal, { backgroundColor: inverse ? "#FFFFFF" : COLORS.primary }]} /></View><View style={styles.markBars}>{[5, 2, 7, 3, 6].map((width, index) => <View key={index} style={[styles.markBar, { width, backgroundColor: inverse ? "#82E3C0" : COLORS.primary }]} />)}</View></View>;
}

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 124 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 20, alignItems: "center", justifyContent: "center", minHeight: 56, paddingHorizontal: 20, flexDirection: "row-reverse", gap: 9 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", textAlign: "center" },
  secondaryButton: { backgroundColor: "#F2F1EE", borderColor: "#F2F1EE", borderWidth: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", minHeight: 54, paddingHorizontal: 20, flexDirection: "row-reverse", gap: 9 },
  secondaryButtonText: { color: COLORS.ink, fontSize: 15, fontWeight: "800", textAlign: "center" },
  input: { backgroundColor: "#F2F1EE", borderWidth: 1, borderColor: "#F2F1EE", borderRadius: 21, minHeight: 54, paddingHorizontal: 16, fontSize: 15, color: COLORS.ink, textAlign: "right", writingDirection: "rtl" },
  inputLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "900", marginBottom: 8, textAlign: "right" },
  inputGroup: { marginBottom: 14 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 13 },
});

const styles = StyleSheet.create({
  referenceTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 45, marginBottom: 14 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  topIconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 23 },
  headerText: { flex: 1, alignItems: "flex-end" },
  pageTitle: { color: COLORS.ink, fontSize: 29, lineHeight: 36, fontWeight: "900", textAlign: "right", letterSpacing: -0.5 },
  pageSubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 5, textAlign: "right" },
  headerAction: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingVertical: 7, marginRight: 14 },
  headerActionText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 26, padding: 16 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "900", textAlign: "right" },
  sectionAction: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, lineHeight: 13, fontWeight: "900", textAlign: "center" },
  roundIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pharmacyMark: { width: 48, height: 48, borderRadius: 15, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4 },
  pharmacyMarkSmall: { width: 42, height: 42, borderRadius: 13 },
  markCross: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  markCrossVertical: { position: "absolute", width: 6, height: 20, borderRadius: 2 },
  markCrossHorizontal: { position: "absolute", width: 20, height: 6, borderRadius: 2 },
  markBars: { height: 19, flexDirection: "row", alignItems: "center", gap: 2 },
  markBar: { height: 17, borderRadius: 1 },
});
