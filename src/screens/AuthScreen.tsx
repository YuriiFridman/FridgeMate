import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { joinFamilyByInviteCode } from "../lib/userSetup";

interface AuthScreenProps {
  onAuthSuccess: () => Promise<void>;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || null,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          if (familyCode.trim()) {
            await joinFamilyByInviteCode(familyCode.trim());
          }
          await onAuthSuccess();
        } else {
          setInfo("Аккаунт создан. Если включено подтверждение, проверьте почту.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw signInError;
        }

        await onAuthSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Мой Холодильник</Text>
          <Text style={styles.subtitle}>
            {isRegisterMode ? "Создайте аккаунт" : "Войдите в аккаунт"}
          </Text>

          {isRegisterMode ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Имя (необязательно)"
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                placeholder="Код семьи (необязательно)"
                placeholderTextColor="#9CA3AF"
                value={familyCode}
                onChangeText={setFamilyCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            disabled={isLoading}
            onPress={submit}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                {isRegisterMode ? "Начать" : "Войти"}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setError(null);
              setInfo(null);
              setIsRegisterMode((prev) => !prev);
            }}
          >
            <Text style={styles.secondaryText}>
              {isRegisterMode
                ? "Уже есть аккаунт? Войти"
                : "Нет аккаунта? Зарегистрироваться"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
    marginBottom: 14,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 15,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: "#E11D48",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 6,
    alignItems: "center",
  },
  secondaryText: {
    color: "#374151",
    fontWeight: "600",
  },
  errorText: {
    color: "#B91C1C",
    fontWeight: "500",
  },
  infoText: {
    color: "#065F46",
    fontWeight: "500",
  },
});
