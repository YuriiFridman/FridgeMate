import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../components/AppCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenHeader } from "../components/ScreenHeader";
import { getFamilyContext, type FamilyRole } from "../lib/family";
import { joinFamilyByInviteCode, toFamilyInviteCode } from "../lib/userSetup";
import {
  getProfilesByHousehold,
  updateProfileName,
  updateProfileRole,
} from "../repositories/profileRepository";
import { supabase } from "../lib/supabase";
import { useAppTheme } from "../theme/appTheme";

interface FamilyMember {
  id: string;
  full_name: string | null;
  role?: FamilyRole;
}

export default function ProfileScreen() {
  const { palette, spacing } = useAppTheme();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyLabel, setFamilyLabel] = useState("Family: ...");
  const [role, setRole] = useState<FamilyRole>("Member");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [members, setMembers] = useState<FamilyMember[]>([]);

  const load = useCallback(async () => {
    const family = await getFamilyContext();
    if (!family) return;
    setFamilyId(family.familyId);
    setFamilyLabel(`Family: ${family.familyName}`);
    setRole(family.role);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setName(String(user?.user_metadata?.full_name ?? ""));

    const familyMembers = await getProfilesByHousehold(family.familyId);
    setMembers(
      familyMembers.map((member) => ({
        id: member.id,
        full_name: member.full_name,
        role: member.role as FamilyRole | undefined,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (!familyId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await updateProfileName(user.id, familyId, name.trim());

    if (password.trim().length > 0) {
      await supabase.auth.updateUser({ password });
      setPassword("");
    }
    Alert.alert("Сохранено", "Профиль обновлен.");
  };

  const generateInviteCode = () => {
    if (!(role === "Owner" || role === "Admin") || !familyId) return;
    setInviteCode(toFamilyInviteCode(familyId));
  };

  const promoteToAdmin = async (memberId: string) => {
    if (role !== "Owner" || !familyId) return;
    try {
      await updateProfileRole(memberId, familyId, "Admin");
    } catch {
      Alert.alert(
        "Нужно обновить БД",
        "Не удалось повысить роль. Добавьте колонку role в таблицу profiles.",
      );
      return;
    }
    await load();
  };

  const handleJoinFamily = async () => {
    if (!joinCode.trim()) {
      Alert.alert("Код не указан", "Введите код приглашения семьи.");
      return;
    }

    Alert.alert(
      "Перейти в другую семью?",
      "Текущая семья будет удалена, и вы перейдете в новую по коду.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Перейти",
          style: "destructive",
          onPress: async () => {
            try {
              await joinFamilyByInviteCode(joinCode.trim());
              setJoinCode("");
              await load();
              Alert.alert("Готово", "Вы присоединились к новой семье.");
            } catch (error) {
              Alert.alert(
                "Ошибка",
                error instanceof Error ? error.message : "Не удалось перейти в семью.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <ScreenContainer maxWidth={860} style={{ gap: spacing.sm }}>
        <ScreenHeader title="Профиль" subtitle="Аккаунт и семейные роли" familyLabel={familyLabel} />
        <AppCard style={styles.card}>
        <Text style={[styles.label, { color: palette.textMuted }]}>Роль: {role}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ваше имя"
          placeholderTextColor={palette.textMuted}
          style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Новый пароль"
          secureTextEntry
          placeholderTextColor={palette.textMuted}
          style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }]}
        />
        <PrimaryButton label="Сохранить" onPress={saveProfile} />
        </AppCard>

        {(role === "Owner" || role === "Admin") && (
          <AppCard style={styles.card}>
            <PrimaryButton label="Сгенерировать Family Invite Link/Code" onPress={generateInviteCode} />
            {inviteCode ? <Text style={[styles.invite, { color: palette.text }]}>Код: {inviteCode}</Text> : null}
          </AppCard>
        )}

        <AppCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Перейти в другую семью</Text>
        <TextInput
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Введите код семьи"
          placeholderTextColor={palette.textMuted}
          style={[styles.input, { borderColor: palette.border, color: palette.text, backgroundColor: palette.bg }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PrimaryButton label="Перейти по коду" onPress={handleJoinFamily} />
        </AppCard>

        {role === "Owner" && (
          <AppCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Управление ролями</Text>
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <Text style={{ color: palette.text }}>
                {member.full_name || member.id.slice(0, 6)} ({member.role ?? "Member"})
              </Text>
              {(member.role ?? "Member") === "Member" ? (
                <Pressable style={[styles.smallButton, { backgroundColor: palette.accent }]} onPress={() => promoteToAdmin(member.id)}>
                  <Text style={styles.smallButtonText}>Сделать Admin</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          </AppCard>
        )}
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  label: { fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  invite: { fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  memberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallButton: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
