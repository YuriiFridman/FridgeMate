import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../components/AppCard";
import { CircleCheck } from "../components/CircleCheck";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { getFamilyContext } from "../lib/family";
import { supabase } from "../lib/supabase";
import { useAppTheme } from "../theme/appTheme";

interface ShoppingItem {
  id: string;
  family_id: string;
  title: string;
  is_bought: boolean;
  created_at?: string;
}

export default function ShoppingScreen() {
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 760;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [familyLabel, setFamilyLabel] = useState("Family: ...");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [manualTitle, setManualTitle] = useState("");

  const sortItems = (list: ShoppingItem[]) =>
    list
      .slice()
      .sort((a, b) => {
        if (a.is_bought !== b.is_bought) {
          return Number(a.is_bought) - Number(b.is_bought);
        }
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

  const loadItems = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setIsLoading(true);
    }
    const family = await getFamilyContext();
    if (!family) {
      setItems([]);
      setFamilyLabel("Family: не подключена");
      setFamilyId(null);
      if (showSpinner) setIsLoading(false);
      return;
    }

    setFamilyId(family.familyId);
    setFamilyLabel(`Family: ${family.familyName}`);

    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("family_id", family.familyId)
      .order("is_bought", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setItems([]);
      if (showSpinner) setIsLoading(false);
      return;
    }

    setItems(sortItems((data ?? []) as ShoppingItem[]));
    if (showSpinner) setIsLoading(false);
    setHasLoadedOnce(true);
  }, []);

  useEffect(() => {
    void loadItems(true);
  }, [loadItems]);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`shopping-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          void loadItems(false);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId, loadItems]);

  const addManualItem = async () => {
    if (!familyId || !manualTitle.trim()) return;
    const payload = {
      family_id: familyId,
      title: manualTitle.trim(),
      is_bought: false,
      source: "manual",
    };
    const { error } = await supabase.from("shopping_items").insert(payload);
    if (error) {
      return;
    }
    setManualTitle("");
    await loadItems(false);
  };

  const toggleBought = async (item: ShoppingItem) => {
    setItems((prev) =>
      sortItems(
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, is_bought: !entry.is_bought } : entry,
        ),
      ),
    );
    const { error } = await supabase
      .from("shopping_items")
      .update({ is_bought: !item.is_bought })
      .eq("id", item.id)
      .eq("family_id", item.family_id);
    if (error) {
      setItems((prev) =>
        sortItems(
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, is_bought: item.is_bought } : entry,
          ),
        ),
      );
      return;
    }
  };

  const clearBoughtItems = async () => {
    if (!familyId) return;
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("family_id", familyId)
      .eq("is_bought", true);
    if (error) {
      return;
    }
    await loadItems(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <ScreenHeader title="Покупки" subtitle="Список того, что нужно купить" familyLabel={familyLabel} />
      <View style={[styles.addRow, isCompactLayout && styles.addRowCompact]}>
        <TextInput
          value={manualTitle}
          onChangeText={setManualTitle}
          placeholder="Добавить вручную (например, Soap)"
          placeholderTextColor={palette.textMuted}
          style={[
            styles.input,
            isCompactLayout && styles.inputCompact,
            { borderColor: palette.border, color: palette.text, backgroundColor: palette.card },
          ]}
        />
        <View style={[styles.addButtonWrap, isCompactLayout && styles.addButtonWrapCompact]}>
          <PrimaryButton label="Добавить" onPress={addManualItem} />
        </View>
      </View>
      <Pressable style={[styles.clearButton, { borderColor: palette.border }]} onPress={clearBoughtItems}>
        <Text style={[styles.clearButtonText, { color: palette.text }]}>Очистить отмеченные</Text>
      </Pressable>

      {isLoading && !hasLoadedOnce ? <ActivityIndicator color={palette.accent} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.itemPressable, pressed && styles.itemPressablePressed]}
            onPress={() => toggleBought(item)}
          >
            <AppCard style={styles.item}>
              <CircleCheck checked={item.is_bought} />
              <Text
                style={[
                  styles.itemText,
                  { color: palette.text },
                  item.is_bought && styles.itemTextBought,
                ]}
              >
                {item.title}
              </Text>
            </AppCard>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", maxWidth: 960, alignSelf: "center", paddingHorizontal: 16 },
  addRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  addRowCompact: { flexDirection: "column" },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inputCompact: { width: "100%" },
  addButtonWrap: { minWidth: 116 },
  addButtonWrapCompact: { width: "100%" },
  clearButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  clearButtonText: { fontWeight: "600" },
  list: { paddingBottom: 20, gap: 8 },
  itemPressable: {
    borderRadius: 12,
  },
  itemPressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.996 }],
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemText: { fontSize: 15, fontWeight: "600" },
  itemTextBought: { textDecorationLine: "line-through", opacity: 0.6 },
});
