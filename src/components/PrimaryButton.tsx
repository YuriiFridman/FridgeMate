import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useAppTheme } from "../theme/appTheme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: PrimaryButtonProps) {
  const { palette } = useAppTheme();
  const blocked = loading || disabled;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.accent },
        (blocked || pressed) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={blocked}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  label: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
