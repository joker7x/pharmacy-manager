import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/components/app-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function BarcodeScanner({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (barcode: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  useEffect(() => { if (visible) setHasScanned(false); }, [visible]);

  const scan = (value: string) => {
    if (hasScanned || !value) return;
    setHasScanned(true);
    onScanned(value);
    onClose();
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={styles.container}>{Platform.OS === "web" ? <View style={styles.center}><IconSymbol name="barcode.viewfinder" size={42} color={COLORS.primary} /><Text style={styles.title}>المسح بالكاميرا متاح على الهاتف</Text><Text style={styles.text}>استخدم إدخال الباركود يدويًا من خانة البحث عند العمل على الويب.</Text></View> : !permission ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View> : !permission.granted ? <View style={styles.center}><IconSymbol name="barcode.viewfinder" size={42} color={COLORS.primary} /><Text style={styles.title}>إذن الكاميرا مطلوب</Text><Text style={styles.text}>اسمح بالكاميرا لمسح باركود عبوة الدواء وإضافته سريعًا.</Text><TouchableOpacity onPress={requestPermission} style={styles.permissionButton} activeOpacity={0.8}><Text style={styles.permissionButtonText}>السماح بالكاميرا</Text></TouchableOpacity></View> : <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "qr"] }} onBarcodeScanned={hasScanned ? undefined : ({ data }) => scan(data)}><View style={styles.cameraOverlay}><View style={styles.scanFrame} /><Text style={styles.cameraText}>وجّه الكاميرا نحو باركود العبوة</Text></View></CameraView>}<TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.8}><IconSymbol name="xmark" size={20} color={COLORS.ink} /><Text style={styles.closeText}>إغلاق</Text></TouchableOpacity></View></Modal>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24, paddingTop: 56 }, camera: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#102321" }, cameraOverlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" }, scanFrame: { width: "75%", aspectRatio: 1.7, borderWidth: 2, borderColor: "#FFFFFF", borderRadius: 18 }, cameraText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginTop: 22 }, center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }, title: { color: COLORS.ink, fontSize: 18, fontWeight: "900", textAlign: "center", marginTop: 14 }, text: { color: COLORS.muted, fontSize: 13, lineHeight: 21, textAlign: "center", marginTop: 8 }, permissionButton: { marginTop: 20, minHeight: 46, backgroundColor: COLORS.primary, paddingHorizontal: 22, borderRadius: 14, justifyContent: "center" }, permissionButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, closeButton: { minHeight: 48, alignSelf: "center", flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 15, paddingHorizontal: 20 }, closeText: { color: COLORS.ink, fontSize: 13, fontWeight: "800" },
});
