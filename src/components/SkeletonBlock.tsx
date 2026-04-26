import { View, StyleSheet, type ViewProps } from "react-native";

import { useAppTheme } from "../theme/appTheme";

interface SkeletonBlockProps extends ViewProps {
  height?: number;
}

export function SkeletonBlock({ style, height = 14, ...props }: SkeletonBlockProps) {
  const { isDark } = useAppTheme();
  return (
    <View
      {...props}
      style={[
        styles.base,
        { height, backgroundColor: isDark ? "rgba(148,163,184,0.2)" : "#E5E7EB" },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    width: "100%",
  },
});
