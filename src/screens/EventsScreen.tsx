import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../components/AppCard";
import { CircleCheck } from "../components/CircleCheck";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenHeader } from "../components/ScreenHeader";
import { ThemedInput } from "../components/ThemedInput";
import { trackEvent } from "../lib/telemetry";
import { isFeatureEnabled } from "../lib/featureFlags";
import {
  buildEventChecklist,
  categorizeShoppingItems,
  estimateBudgetBand,
  type EventChecklistItem,
} from "../features/smartPlanning";
import { getFamilyContext } from "../lib/family";
import { addShoppingItems } from "../repositories/shoppingRepository";
import { loadEventChecklist, saveEventChecklist } from "../repositories/eventChecklistRepository";
import { getCurrentUserPreferences } from "../repositories/profilePreferencesRepository";
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
  const { palette, spacing } = useAppTheme();
  const { width } = useWindowDimensions();
  const { items, householdLabel } = useInventory();
  const isCompactLayout = width < 760;
  const [peopleCount, setPeopleCount] = useState("6");
  const [menu, setMenu] = useState<EventDish[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [missingResult, setMissingResult] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<EventChecklistItem[]>([]);
  const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [preferencesHint, setPreferencesHint] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingList, setIsBuildingList] = useState(false);

  const inventoryNames = useMemo(() => items.map((item) => item.name), [items]);

  useEffect(() => {
    getFamilyContext()
      .then(async (family) => {
        if (!family) return;
        setCurrentFamilyId(family.familyId);
        const saved = await loadEventChecklist(family.familyId);
        if (saved?.length) {
          setChecklist(saved);
        }
      })
      .catch(() => {});
    getCurrentUserPreferences()
      .then((preferences) => {
        const chunks: string[] = [];
        if (preferences.diet) chunks.push(`тип питания: ${preferences.diet}`);
        if (preferences.allergies.length) chunks.push(`аллергии: ${preferences.allergies.join(", ")}`);
        if (preferences.excluded_ingredients.length) {
          chunks.push(`исключить: ${preferences.excluded_ingredients.join(", ")}`);
        }
        setPreferencesHint(chunks.join("; "));
      })
      .catch(() => setPreferencesHint(""));
  }, []);

  const generateMenu = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateEventMenu(Number(peopleCount) || 1, {
        budgetEuro: budget.trim() ? Math.max(0, Number(budget) || 0) : null,
        preferencesHint,
      });
      trackEvent("events_menu_generated", {
        peopleCount: Math.max(1, Number(peopleCount) || 1),
        dishes: generated.length,
      });
      setMenu(generated);
      const initialChecklist = buildEventChecklist(Number(peopleCount) || 1);
      setChecklist(initialChecklist);
      if (currentFamilyId) {
        await saveEventChecklist(currentFamilyId, initialChecklist);
      }
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
      const categorized = categorizeShoppingItems(diff.missing);
      setMissingResult(Object.values(categorized).flat());

      const family = await getFamilyContext();
      if (family && diff.missing.length > 0) {
        try {
          await addShoppingItems(
            diff.missing.map((title) => ({
              familyId: family.familyId,
              title,
              source: "events",
            })),
          );
        } catch (error) {
          Alert.alert(
            "Ошибка",
            `Не удалось отправить в покупки: ${error instanceof Error ? error.message : "неизвестная ошибка"}`,
          );
          return;
        }
        Alert.alert("Готово", "Список покупок обновлен.");
        trackEvent("events_shopping_sync", { missingCount: diff.missing.length });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <ScreenContainer style={{ gap: spacing.sm }}>
        <ScreenHeader title="Посиделки" subtitle="Праздничное меню и закупка" familyLabel={householdLabel} />

      <View style={[styles.row, isCompactLayout && styles.rowCompact]}>
        <ThemedInput
          value={peopleCount}
          onChangeText={setPeopleCount}
          keyboardType="numeric"
          placeholder="Сколько человек"
          style={[styles.input, isCompactLayout && styles.inputCompact]}
        />
        <ThemedInput
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
          placeholder={`Бюджет (€), напр. ${estimateBudgetBand(Number(peopleCount) || 1).min}`}
          style={[styles.input, isCompactLayout && styles.inputCompact]}
        />
        <View style={[styles.generateWrap, isCompactLayout && styles.generateWrapCompact]}>
          <PrimaryButton label="Сгенерировать" onPress={generateMenu} loading={isGenerating} />
        </View>
      </View>
      {isFeatureEnabled("smartPlanning") ? (
      <AppCard style={styles.budgetCard}>
        <Text style={[styles.budgetTitle, { color: palette.text }]}>Smart Budget</Text>
        <Text style={{ color: palette.textMuted }}>
          Рекомендуемый диапазон на {Math.max(1, Number(peopleCount) || 1)} чел.:{" "}
          {estimateBudgetBand(Number(peopleCount) || 1).min}€ -{" "}
          {estimateBudgetBand(Number(peopleCount) || 1).max}€
        </Text>
        {budget ? (
          <Text style={{ color: palette.textMuted }}>
            Введенный бюджет: {Math.max(0, Number(budget) || 0)}€
          </Text>
        ) : null}
      </AppCard>
      ) : null}

        <FlatList
        data={menu}
        keyExtractor={(dish) => dish.title}
        contentContainerStyle={styles.list}
        renderItem={({ item: dish }) => {
          const selected = selectedTitles.includes(dish.title);
          return (
            <Pressable
              style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressablePressed]}
              onPress={() =>
                setSelectedTitles((prev) =>
                  selected ? prev.filter((entry) => entry !== dish.title) : [...prev, dish.title],
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
        }}
        ListFooterComponent={
          <View style={styles.footerWrap}>
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
            {isFeatureEnabled("smartPlanning") && checklist.length > 0 ? (
              <AppCard style={styles.resultCard}>
                <Text style={[styles.resultTitle, { color: palette.text }]}>Чеклист подготовки</Text>
                {checklist.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.checklistRow}
                    onPress={async () => {
                      const updated = checklist.map((entry) =>
                        entry.id === item.id ? { ...entry, done: !entry.done } : entry,
                      );
                      setChecklist(updated);
                      if (currentFamilyId) {
                        await saveEventChecklist(currentFamilyId, updated);
                      }
                    }}
                  >
                    <CircleCheck checked={item.done} />
                    <Text style={{ color: palette.textMuted }}>{item.title}</Text>
                  </Pressable>
                ))}
              </AppCard>
            ) : null}
          </View>
        }
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  budgetCard: { gap: 6, marginBottom: 8 },
  budgetTitle: { fontWeight: "700" },
  footerWrap: { gap: 8 },
  resultCard: { marginTop: 8, gap: 4 },
  resultTitle: { fontWeight: "700", marginBottom: 4 },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
