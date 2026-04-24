import { StyleSheet, View, type ViewProps } from "react-native";

import { useAppTheme } from "../theme/appTheme";

export function AppCard({ style, ...props }: ViewProps) {
  const { isDark, palette } = useAppTheme();
  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: isDark ? "#334155" : "#E5E7EB",
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.gloss,
          { backgroundColor: isDark ? "rgba(148,163,184,0.08)" : "rgba(255,255,255,0.75)" },
        ]}
      />
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
});
