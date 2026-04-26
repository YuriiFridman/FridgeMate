import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../components/AppCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { ScreenContainer } from "../components/ScreenContainer";
import { ScreenHeader } from "../components/ScreenHeader";
import { useInventory } from "../hooks/useInventory";
import {
  generateRecipes,
  generateWeeklyPlan,
  type GeneratedRecipe,
  type WeeklyPlanDay,
} from "../services/aiService";
import { useAppTheme } from "../theme/appTheme";
import { deleteInventoryItems } from "../repositories/inventoryRepository";
import { getCurrentUserPreferences } from "../repositories/profilePreferencesRepository";

function normalizeFoodName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+([.,]\d+)?\s*(г|гр|кг|мл|л|шт|шт\.|pcs|pc)\b/gi, " ")
    .replace(/[^a-zа-яё\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIngredientMatchedToItem(ingredient: string, itemName: string) {
  const normalizedIngredient = normalizeFoodName(ingredient);
  const normalizedItem = normalizeFoodName(itemName);
  if (!normalizedIngredient || !normalizedItem) return false;
  if (normalizedIngredient === normalizedItem) return true;
  if (normalizedIngredient.length >= 5 && normalizedItem.includes(normalizedIngredient)) return true;
  if (normalizedItem.length >= 5 && normalizedIngredient.includes(normalizedItem)) return true;

  const ingredientTokens = normalizedIngredient
    .split(" ")
    .filter((token) => token.length >= 4);
  const itemTokens = normalizedItem.split(" ").filter((token) => token.length >= 4);
  const overlap = ingredientTokens.filter((token) => itemTokens.includes(token)).length;
  return overlap > 0 && overlap >= Math.min(ingredientTokens.length, 2);
}

export default function RecipeScreen() {
  const { items, reload, householdLabel } = useInventory();
  const { isDark, palette, spacing } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 760;
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanDay[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferencesHint, setPreferencesHint] = useState("");

  useEffect(() => {
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

  const productsForPrompt = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
      .map((item) => item.name.trim())
      .filter((name) => name.length > 0);
  }, [items]);

  const handleGenerateRecipes = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      const generated = await generateRecipes(productsForPrompt, { preferencesHint });
      setRecipes(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сгенерировать рецепты.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateWeeklyPlan = async () => {
    try {
      setError(null);
      setIsGeneratingPlan(true);
      const plan = await generateWeeklyPlan(productsForPrompt, { preferencesHint });
      setWeeklyPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать недельный план.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleCooked = (recipe: GeneratedRecipe) => {
    const usedItems = items.filter((item) => {
      return recipe.ingredients.some((ingredient) =>
        isIngredientMatchedToItem(ingredient, item.name),
      );
    });

    if (usedItems.length === 0) {
      Alert.alert("Нет совпадений", "Не удалось определить использованные ингредиенты.");
      return;
    }

    Alert.alert(
      "Подтверждение",
      "Удалить использованные ингредиенты из холодильника?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            await deleteInventoryItems(usedItems.map((item) => item.id));
            await reload();
          },
        },
      ],
    );
  };

  const feedData = useMemo(
    () =>
      [
        ...(weeklyPlan.length > 0 ? [{ type: "plan" as const }] : []),
        ...recipes.map((recipe, index) => ({
          type: "recipe" as const,
          recipe,
          key: `${recipe.title}-${index}`,
        })),
        ...(!isGenerating && recipes.length === 0 ? [{ type: "empty" as const }] : []),
      ] as const,
    [isGenerating, recipes, weeklyPlan.length],
  );

  const renderFeedItem: ListRenderItem<(typeof feedData)[number]> = ({ item }) => {
    if (item.type === "plan") {
      return (
        <AppCard style={styles.planCard}>
          <Text style={[styles.planTitle, { color: palette.text }]}>План ужинов на неделю</Text>
          {weeklyPlan.map((entry, index) => (
            <View key={`${entry.day}-${index}`} style={[styles.planRow, { borderBottomColor: palette.border }]}>
              <Text style={[styles.planDay, { color: palette.accent }]}>{entry.day}</Text>
              <Text style={[styles.planDish, { color: palette.text }]}>{entry.title}</Text>
              <Text style={[styles.planReason, { color: palette.textMuted }]}>{entry.reason}</Text>
              <Text style={[styles.planTime, { color: palette.textMuted }]}>{entry.time}</Text>
            </View>
          ))}
        </AppCard>
      );
    }
    if (item.type === "empty") {
      return (
        <AppCard style={styles.emptyCard}>
          <MaterialCommunityIcons name="book-open-page-variant" size={24} color={palette.textMuted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Пока нет рецептов</Text>
          <Text style={[styles.emptySubtitle, { color: palette.textMuted }]}>Нажмите кнопку выше, чтобы получить 3 идеи из ваших продуктов.</Text>
        </AppCard>
      );
    }
    return (
      <AppCard
        key={item.key}
        style={[
          styles.recipeCard,
          {
            borderColor: isDark ? "#334155" : "#F1F5F9",
            backgroundColor: palette.card,
          },
        ]}
      >
        <View style={styles.recipeTitleRow}>
          <MaterialCommunityIcons name="food-variant" size={18} color={palette.accent} />
          <Text style={[styles.recipeTitle, { color: palette.text }]}>{item.recipe.title}</Text>
        </View>
        <Text style={[styles.sectionLabel, { color: isDark ? "#E2E8F0" : "#374151" }]}>Ингредиенты</Text>
        {item.recipe.ingredients.map((ingredient, ingredientIndex) => (
          <Text key={`${ingredient}-${ingredientIndex}`} style={[styles.recipeLine, { color: palette.textMuted }]}>
            - {ingredient}
          </Text>
        ))}
        <Text style={[styles.timeBadge, { color: palette.accent }]}>Время: {item.recipe.time}</Text>
        <Text style={[styles.sectionLabel, { color: isDark ? "#E2E8F0" : "#374151" }]}>Шаги</Text>
        <Text style={[styles.recipeLine, { color: palette.textMuted }]}>{item.recipe.steps}</Text>
        <PrimaryButton label="Приготовил(а)" onPress={() => handleCooked(item.recipe)} />
      </AppCard>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <ScreenContainer maxWidth={980} style={{ gap: spacing.sm }}>
        <ScreenHeader
        title="Рецепты"
        subtitle="Готовим из того, что уже есть в холодильнике"
        familyLabel={householdLabel}
        />

        <View style={[styles.actions, isCompactLayout && styles.actionsCompact]}>
        <View style={[styles.primaryWrap, isCompactLayout && styles.primaryWrapCompact]}>
          <PrimaryButton
            label="✨ Создать рецепт"
            onPress={handleGenerateRecipes}
            loading={isGenerating}
          />
        </View>
        <View style={[styles.primaryWrap, isCompactLayout && styles.primaryWrapCompact]}>
          <PrimaryButton
            label="📅 Автоплан на неделю"
            onPress={handleGenerateWeeklyPlan}
            loading={isGeneratingPlan}
          />
        </View>
        <Pressable
          style={[
            styles.syncButton,
            isCompactLayout && styles.syncButtonCompact,
            { borderColor: palette.border, backgroundColor: palette.card },
          ]}
          onPress={async () => {
            try {
              setIsRefreshing(true);
              await reload();
            } finally {
              setIsRefreshing(false);
            }
          }}
        >
          <MaterialCommunityIcons name="sync" size={16} color={palette.text} />
          <Text style={[styles.syncButtonText, { color: palette.text }]}>Обновить</Text>
        </Pressable>
        </View>

        <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={feedData}
        keyExtractor={(item, index) =>
          item.type === "recipe" ? item.key : `${item.type}-${index}`
        }
        renderItem={renderFeedItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              try {
                setIsRefreshing(true);
                await reload();
              } finally {
                setIsRefreshing(false);
              }
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {error ? <Text style={[styles.errorText, { backgroundColor: isDark ? "#3F1D1D" : "#FEF2F2" }]}>{error}</Text> : null}
            {isGenerating ? (
              <AppCard style={styles.loadingCard}>
                <ActivityIndicator size="large" color={palette.accent} />
                <Text style={[styles.loadingText, { color: palette.textMuted }]}>ИИ думает над рецептами...</Text>
                <SkeletonBlock height={12} />
                <SkeletonBlock height={12} />
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
  actions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  actionsCompact: {
    flexDirection: "column",
  },
  primaryWrap: {
    flex: 1,
  },
  primaryWrapCompact: {
    width: "100%",
  },
  syncButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    minWidth: 96,
  },
  syncButtonCompact: {
    width: "100%",
    minHeight: 44,
  },
  syncButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  list: {
    marginTop: 14,
  },
  listContent: {
    gap: 10,
    paddingBottom: 32,
  },
  headerWrap: {
    gap: 10,
  },
  recipeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  planCard: {
    gap: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  planRow: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 2,
    gap: 2,
  },
  planDay: {
    fontWeight: "700",
  },
  planDish: {
    fontSize: 15,
    fontWeight: "700",
  },
  planReason: {
    fontSize: 13,
  },
  planTime: {
    fontSize: 12,
    fontWeight: "600",
  },
  recipeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  recipeTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  sectionLabel: {
    marginTop: 6,
    marginBottom: 4,
    color: "#374151",
    fontWeight: "700",
  },
  recipeLine: {
    color: "#4B5563",
    marginBottom: 2,
  },
  timeBadge: {
    marginTop: 8,
    fontWeight: "700",
  },
  emptyCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    textAlign: "center",
    color: "#6B7280",
  },
  errorText: {
    color: "#B91C1C",
    fontWeight: "600",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingCard: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontWeight: "600",
  },
});
