import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { useAppTheme } from "../theme/appTheme";

interface ThemedInputProps extends TextInputProps {
  hasError?: boolean;
}

export function ThemedInput({ style, hasError = false, ...props }: ThemedInputProps) {
  const { palette, radius, spacing, typography } = useAppTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? palette.textMuted}
      style={[
        styles.input,
        {
          borderRadius: radius.md,
          borderColor: hasError ? "#EF4444" : palette.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          color: palette.text,
          backgroundColor: palette.card,
          fontSize: typography.body,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
  },
});
