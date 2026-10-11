import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";
import { COLORS } from "@/components/app-ui";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({ children, edges = ["top", "left", "right"], className, containerClassName, safeAreaClassName, style, ...props }: ScreenContainerProps) {
  return <View style={[{ flex: 1, backgroundColor: COLORS.background }, style]} className={cn("flex-1", containerClassName)} {...props}><SafeAreaView edges={edges} className={cn("flex-1", safeAreaClassName)}><View className={cn("flex-1", className)}>{children}</View></SafeAreaView></View>;
}
