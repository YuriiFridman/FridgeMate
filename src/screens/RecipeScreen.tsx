import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useInventory } from "../hooks/useInventory";
import { generateRecipes, type GeneratedRecipe } from "../services/aiService";
import { useAppTheme } from "../theme/appTheme";

export default function RecipeScreen() {
  const { items, reload, householdLabel } = useInventory();
  const { isDark, palette } = useAppTheme();
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const generated = await generateRecipes(productsForPrompt);
      setRecipes(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сгенерировать рецепты.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="silverware-fork-knife" size={22} color={palette.accent} />
        <Text style={[styles.title, { color: palette.text }]}>Рецепты</Text>
      </View>
      <Text style={[styles.groupLabel, { color: palette.textMuted }]}>{householdLabel}</Text>
      <Text style={[styles.subtitle, { color: palette.textMuted }]}>Готовим из того, что уже есть в холодильнике</Text>

      <View style={styles.actions}>
        <Pressable style={[styles.primaryButton, { backgroundColor: palette.accent }]} onPress={handleGenerateRecipes} disabled={isGenerating}>
          {isGenerating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons name="chef-hat" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.primaryButtonText}>✨ Спасти еду (Создать рецепты)</Text>
        </Pressable>
        <Pressable
          style={[styles.syncButton, { borderColor: palette.border, backgroundColor: palette.card }]}
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
          <Text style={[styles.syncButtonText, { color: palette.text }]}>Sync</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {recipes.map((recipe, index) => (
          <View key={`${recipe.title}-${index}`} style={[styles.recipeCard, { borderColor: isDark ? "#334155" : "#F1F5F9", backgroundColor: palette.card }]}>
            <View style={styles.recipeTitleRow}>
              <MaterialCommunityIcons name="food-variant" size={18} color={palette.accent} />
              <Text style={[styles.recipeTitle, { color: palette.text }]}>{recipe.title}</Text>
            </View>
            <Text style={[styles.sectionLabel, { color: isDark ? "#E2E8F0" : "#374151" }]}>Ингредиенты</Text>
            {recipe.ingredients.map((ingredient, ingredientIndex) => (
              <Text key={`${ingredient}-${ingredientIndex}`} style={[styles.recipeLine, { color: palette.textMuted }]}>
                - {ingredient}
              </Text>
            ))}
            <Text style={[styles.timeBadge, { color: palette.accent }]}>Время: {recipe.time}</Text>
            <Text style={[styles.sectionLabel, { color: isDark ? "#E2E8F0" : "#374151" }]}>Шаги</Text>
            <Text style={[styles.recipeLine, { color: palette.textMuted }]}>{recipe.steps}</Text>
          </View>
        ))}
        {!isGenerating && recipes.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <MaterialCommunityIcons name="book-open-page-variant" size={24} color={palette.textMuted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Пока нет рецептов</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textMuted }]}>Нажмите кнопку выше, чтобы получить 3 идеи из ваших продуктов.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    color: "#6B7280",
    fontWeight: "500",
  },
  groupLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#E11D48",
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
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
  recipeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  },
});
