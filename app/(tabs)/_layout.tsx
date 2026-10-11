import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { COLORS } from "@/components/app-ui";
import { useStaffSession } from "@/lib/staff-session";

function TabIcon({ name, color, focused }: { name: Parameters<typeof IconSymbol>[0]["name"]; color: string; focused: boolean }) {
  return <View style={[styles.iconBox, focused && styles.iconBoxActive]}><IconSymbol size={22} name={name} color={focused ? "#FFFFFF" : color} /></View>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { can } = useStaffSession();
  const bottomPadding = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.primary, tabBarInactiveTintColor: "#A3AAA7", tabBarButton: HapticTab, tabBarStyle: { height: 68 + bottomPadding, paddingTop: 6, paddingBottom: bottomPadding, backgroundColor: "#FFFFFF", borderTopColor: "#ECECE8", borderTopWidth: 1, elevation: 0, shadowOpacity: 0 }, tabBarLabelStyle: { fontSize: 10, fontWeight: "900", marginTop: 1 }, tabBarItemStyle: { paddingHorizontal: 1 } }}>
    <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, focused }) => <TabIcon name="rectangle.grid.2x2.fill" color={color} focused={focused} /> }} />
    {/* المخزون لم يعد تبويبًا سفليًا؛ يبقى مسارًا قابلًا للفتح من صفحة الإدارة. */}
    <Tabs.Screen name="inventory" options={{ href: null }} />
    <Tabs.Screen name="sales" options={{ href: can("sales.use") ? undefined : null, title: "البيع", tabBarIcon: ({ color, focused }) => <TabIcon name="cart.fill" color={color} focused={focused} /> }} />
    <Tabs.Screen name="alerts" options={{ href: can("inventory.view") ? undefined : null, title: "النواقص", tabBarIcon: ({ color, focused }) => <TabIcon name="bell.fill" color={color} focused={focused} /> }} />
    <Tabs.Screen name="more" options={{ title: "الإدارة", tabBarIcon: ({ color, focused }) => <TabIcon name="ellipsis.circle.fill" color={color} focused={focused} /> }} />
  </Tabs>;
}

const styles = StyleSheet.create({ iconBox: { width: 42, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" }, iconBoxActive: { backgroundColor: COLORS.primary } });
