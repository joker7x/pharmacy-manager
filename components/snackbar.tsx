import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";

type SnackbarRequest = { message: string; actionLabel?: string; onAction?: () => void; tone?: "neutral" | "danger" };
type SnackbarValue = { show: (request: SnackbarRequest) => void };

const SnackbarContext = createContext<SnackbarValue | null>(null);
const VISIBLE_MS = 5000;

/** شريط تراجع موحّد لكل عمليات التطبيق (المواصفات: كل تغيير قابل للتراجع ٥ ثوانٍ). */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<SnackbarRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((request: SnackbarRequest) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(request);
    timer.current = setTimeout(() => setCurrent(null), VISIBLE_MS);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? (
        <View style={[styles.bar, current.tone === "danger" && styles.barDanger]}>
          <IconSymbol name={current.tone === "danger" ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"} size={16} color="#82E3C0" />
          <Text style={styles.message} numberOfLines={2}>{current.message}</Text>
          {current.actionLabel ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { current.onAction?.(); if (timer.current) clearTimeout(timer.current); setCurrent(null); }}
              style={styles.action}
              activeOpacity={0.8}
            >
              <Text style={styles.actionText}>{current.actionLabel}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setCurrent(null)} style={styles.action} activeOpacity={0.8} accessibilityLabel="إخفاء">
              <IconSymbol name="xmark" size={14} color="#B9C6C2" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error("useSnackbar يجب أن يُستخدم داخل SnackbarProvider.");
  return context;
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 104,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: COLORS.deep,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    elevation: 6,
  },
  barDanger: { backgroundColor: "#3A1E1B" },
  message: { flex: 1, color: "#FFFFFF", fontSize: 12, fontWeight: "800", textAlign: "right", lineHeight: 18 },
  action: { minWidth: 58, minHeight: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionText: { color: "#82E3C0", fontSize: 12, fontWeight: "900" },
});
