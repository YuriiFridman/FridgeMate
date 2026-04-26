import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../components/AppCard";
import { CircleCheck } from "../components/CircleCheck";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { getFamilyContext } from "../lib/family";
import { supabase } from "../lib/supabase";
import {
  compareIngredientsWithInventory,
  generateEventMenu,
  type EventDish,
} from "../services/aiService";
import { useInventory } from "../hooks/useInventory";
import { useAppTheme } from "../theme/appTheme";

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? text;
}

export default function EventsScreen() {
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const { items, householdLabel } = useInventory();
  const isCompactLayout = width < 760;
  const [peopleCount, setPeopleCount] = useState("6");
  const [menu, setMenu] = useState<EventDish[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [missingResult, setMissingResult] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingList, setIsBuildingList] = useState(false);

  const inventoryNames = useMemo(() => items.map((item) => item.name), [items]);

  const generateMenu = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateEventMenu(Number(peopleCount) || 1);
      setMenu(generated);
      setSelectedTitles([]);
      setMissingResult([]);
      if (generated.length === 0) {
        Alert.alert("Пустой ответ", "ИИ не вернул меню, попробуйте еще раз.");
      }
    } catch {
      Alert.alert("Ошибка", "Не удалось сгенерировать меню.");
    } finally {
      setIsGenerating(false);
    }
  };

  const buildShoppingList = async () => {
    if (selectedTitles.length === 0) {
      Alert.alert("Выберите блюда", "Сначала отметьте хотя бы одно блюдо галочкой.");
      return;
    }
    setIsBuildingList(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      const model =
        process.env.EXPO_PUBLIC_GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
      if (!apiKey) {
        throw new Error("Не найден EXPO_PUBLIC_GROQ_API_KEY");
      }

      const selectedDishesBlock = selectedTitles.map((title) => `- ${title}`).join("\n");
      const prompt =
        `Есть выбранные блюда:\n${selectedDishesBlock}\n` +
        `Верни только JSON {"ingredients":["..."]} с общим списком ингредиентов без дублей.`;
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      const raw = await response.text();
      let responseJson: {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      } = {};
      try {
        responseJson = JSON.parse(raw) as typeof responseJson;
      } catch {
        responseJson = {};
      }

      if (!response.ok) {
        throw new Error(responseJson.error?.message ?? "Ошибка генерации ингредиентов.");
      }

      const content = responseJson.choices?.[0]?.message?.content ?? "";
      const json = JSON.parse(extractJson(content)) as { ingredients?: string[] };
      const ingredients = Array.isArray(json.ingredients) ? json.ingredients : [];
      const diff = compareIngredientsWithInventory(
        ingredients.length > 0 ? ingredients : selectedTitles,
        inventoryNames,
      );
      setMissingResult(diff.missing);

      const family = await getFamilyContext();
      if (family && diff.missing.length > 0) {
        const { error } = await supabase.from("shopping_items").insert(
          diff.missing.map((title) => ({
            family_id: family.familyId, // family_id filter is used by design.
            title,
            is_bought: false,
            source: "events",
          })),
        );
        if (error) {
          Alert.alert("Ошибка", `Не удалось отправить в покупки: ${error.message}`);
          return;
        }
        Alert.alert("Готово", "Список покупок обновлен.");
      } else if (!family) {
        Alert.alert("Ошибка", "Не найдена family context.");
      } else {
        Alert.alert("Отлично", "Все ингредиенты уже есть в холодильнике.");
      }
    } catch {
      Alert.alert("Ошибка", "Не удалось собрать ингредиенты.");
    } finally {
      setIsBuildingList(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <ScreenHeader title="Посиделки" subtitle="Праздничное меню и закупка" familyLabel={householdLabel} />

      <View style={[styles.row, isCompactLayout && styles.rowCompact]}>
        <TextInput
          value={peopleCount}
          onChangeText={setPeopleCount}
          keyboardType="numeric"
          placeholder="Сколько человек"
          placeholderTextColor={palette.textMuted}
          style={[
            styles.input,
            isCompactLayout && styles.inputCompact,
            { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
          ]}
        />
        <View style={[styles.generateWrap, isCompactLayout && styles.generateWrapCompact]}>
          <PrimaryButton label="Сгенерировать" onPress={generateMenu} loading={isGenerating} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {menu.map((dish) => {
          const selected = selectedTitles.includes(dish.title);
          return (
            <Pressable
              key={dish.title}
              style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressablePressed]}
              onPress={() =>
                setSelectedTitles((prev) =>
                  selected ? prev.filter((item) => item !== dish.title) : [...prev, dish.title],
                )
              }
            >
              <AppCard style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <CircleCheck checked={selected} />
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{dish.title}</Text>
                </View>
                <Text style={[styles.cardSubtitle, { color: palette.textMuted }]}>{dish.description}</Text>
              </AppCard>
            </Pressable>
          );
        })}

        <PrimaryButton
          label="Собрать ингредиенты и отправить в Покупки"
          onPress={buildShoppingList}
          loading={isBuildingList}
          disabled={selectedTitles.length === 0}
        />

        {missingResult.length > 0 ? (
          <AppCard style={styles.resultCard}>
            <Text style={[styles.resultTitle, { color: palette.text }]}>Нужно докупить:</Text>
            {missingResult.map((item) => (
              <Text key={item} style={{ color: palette.textMuted }}>
                - {item}
              </Text>
            ))}
          </AppCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", maxWidth: 960, alignSelf: "center", paddingHorizontal: 16 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  rowCompact: { flexDirection: "column" },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inputCompact: { width: "100%" },
  generateWrap: { minWidth: 150 },
  generateWrapCompact: { width: "100%" },
  list: { gap: 8, paddingBottom: 20 },
  cardPressable: { borderRadius: 14 },
  cardPressablePressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  card: { gap: 6 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, fontWeight: "500" },
  resultCard: { marginTop: 8, gap: 4 },
  resultTitle: { fontWeight: "700", marginBottom: 4 },
});
