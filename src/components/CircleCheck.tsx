import { StyleSheet, View } from "react-native";

import { useAppTheme } from "../theme/appTheme";

interface CircleCheckProps {
  checked: boolean;
}

export function CircleCheck({ checked }: CircleCheckProps) {
  const { palette, isDark } = useAppTheme();

  return (
    <View
      style={[
        styles.outer,
        {
          borderColor: checked ? palette.accent : isDark ? "#64748B" : "#9CA3AF",
          backgroundColor: checked ? palette.accent : "transparent",
        },
      ]}
    >
      {checked ? <View style={styles.inner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
});
