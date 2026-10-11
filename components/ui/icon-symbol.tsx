// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "line.3.horizontal": "menu",
  "rectangle.grid.2x2.fill": "dashboard",
  "shippingbox.fill": "inventory-2",
  "cart.fill": "point-of-sale",
  "bell.fill": "notifications",
  "ellipsis.circle.fill": "more-horiz",
  "cross.case.fill": "medical-services",
  "magnifyingglass": "search",
  "plus.circle.fill": "add-circle",
  "plus": "add",
  "chart.line.uptrend.xyaxis": "trending-up",
  "truck.box.fill": "local-shipping",
  "gearshape.fill": "settings",
  "minus.circle.fill": "remove-circle",
  "trash": "delete",
  "creditcard.fill": "payments",
  "arrow.clockwise": "refresh",
  "calendar": "calendar-month",
  "checkmark.circle.fill": "check-circle",
  "exclamationmark.triangle.fill": "warning-amber",
  "clock.fill": "schedule",
  "arrow.down.circle.fill": "arrow-downward",
  "person.crop.circle.fill": "account-circle",
  "person.3.fill": "groups",
  "rectangle.portrait.and.arrow.right": "logout",
  "doc.text.fill": "receipt-long",
  "list.bullet.clipboard.fill": "assignment",
  "books.vertical.fill": "menu-book",
  "arrow.triangle.2.circlepath": "sync",
  "camera.fill": "photo-camera",
  "barcode.viewfinder": "qr-code-scanner",
  "photo.on.rectangle.angled": "photo-library",
  "eye.fill": "visibility",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "chevron.left": "chevron-left",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.down": "expand-more",
  "phone.fill": "phone",
  "bubble.left.fill": "chat",
  "square.and.arrow.up": "share",
  "pencil": "edit",
  "printer": "print",
  "lock.fill": "lock",
  "checkmark.icloud": "cloud-done",
  "icloud.slash": "cloud-off",
  "arrow.up.circle.fill": "cloud-upload",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
