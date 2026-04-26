import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/appTheme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  familyLabel?: string;
}

export function ScreenHeader({ title, subtitle, familyLabel }: ScreenHeaderProps) {
  const { palette } = useAppTheme();

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={[styles.accentDot, { backgroundColor: palette.accent }]} />
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      </View>
      {subtitle ? <Text style={[styles.subtitle, { color: palette.textMuted }]}>{subtitle}</Text> : null}
      {familyLabel ? (
        <View style={[styles.familyBadge, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.family, { color: palette.textMuted }]}>{familyLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 2,
    marginBottom: 12,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "500",
  },
  family: {
    fontSize: 12,
    fontWeight: "600",
  },
  familyBadge: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
