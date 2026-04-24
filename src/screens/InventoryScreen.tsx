import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Check,
  RotateCcw,
  LogOut,
  Plus,
  RefreshCcw,
  Refrigerator,
  ScanLine,
  Sun,
  Trash2,
  Moon,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ManualAddModal } from "../components/ManualAddModal";
import { useInventory } from "../hooks/useInventory";
import { supabase } from "../lib/supabase";
import {
  processReceiptFromBase64,
  type ParsedReceiptItem,
} from "../services/aiService";
import type { InventoryCategory, InventoryItem, ManualAddPayload } from "../types/inventory";
import { calculateFreshness } from "../utils/freshness";
import { useAppTheme } from "../theme/appTheme";

const CATEGORY_NORMALIZE_MAP: Record<string, InventoryCategory> = {
  dairy: "Dairy",
  молочное: "Dairy",
  milchprodukte: "Dairy",
  meat: "Meat",
  мясо: "Meat",
  fleisch: "Meat",
  vegetables: "Vegetables",
  овощи: "Vegetables",
  gemuse: "Vegetables",
  gemüse: "Vegetables",
  fruits: "Fruits",
  фрукты: "Fruits",
  obst: "Fruits",
  bakery: "Bakery",
  выпечка: "Bakery",
  backwaren: "Bakery",
  frozen: "Frozen",
  заморозка: "Frozen",
  tiefkuhl: "Frozen",
  tiefkühl: "Frozen",
  pantry: "Pantry",
  бакалея: "Pantry",
  haltbarelebensmittel: "Pantry",
  beverages: "Beverages",
  напитки: "Beverages",
  getranke: "Beverages",
  getränke: "Beverages",
  other: "Other",
  другое: "Other",
};

const CATEGORY_LABELS_RU: Record<InventoryCategory, string> = {
  Dairy: "Молочное",
  Meat: "Мясо",
  Vegetables: "Овощи",
  Fruits: "Фрукты",
  Bakery: "Выпечка",
  Frozen: "Заморозка",
  Pantry: "Бакалея",
  Beverages: "Напитки",
  Other: "Другое",
};

function normalizeCategory(category: string): InventoryCategory {
  return CATEGORY_NORMALIZE_MAP[category.trim().toLowerCase()] ?? "Other";
}

function getCategoryLabel(category: InventoryCategory): string {
  return CATEGORY_LABELS_RU[category];
}

function InventoryRow({
  item,
  onPress,
  onDelete,
  palette,
  isDark,
}: {
  item: InventoryItem;
  onPress: () => void;
  onDelete: () => void;
  palette: { card: string; border: string; text: string; textMuted: string };
  isDark: boolean;
}) {
  const freshness = useMemo(
    () => calculateFreshness(item.expiry_date, item.created_at),
    [item.expiry_date, item.created_at],
  );
  const isWarning = freshness.remainingDays <= 5;
  const remainingLabel = `Осталось ${Math.max(0, freshness.remainingDays)} дн.`;
  const cardBorder = isDark ? "#334155" : "#F1F5F9";

  return (
    <Pressable style={[styles.card, { backgroundColor: palette.card, borderColor: cardBorder }]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={[styles.itemName, { color: palette.text }]}>{item.name}</Text>
        <Pressable style={[styles.deleteHint, { borderColor: "#FCA5A5", backgroundColor: "#FFF1F2" }]} onPress={onDelete} hitSlop={8}>
          <Trash2 size={16} color="#E11D48" />
          <Text style={styles.deleteHintText}>Delete</Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: palette.textMuted }]}>{getCategoryLabel(item.category)}</Text>
        <Text style={[styles.metaText, { color: palette.textMuted }]}>Кол-во: {item.quantity}</Text>
      </View>
      <Text style={[styles.expiryText, { color: palette.textMuted }]}>Годен до: {item.expiry_date}</Text>
      <View
        style={[
          styles.progressTrack,
          isWarning && styles.progressTrackWarningGlow,
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${freshness.percentage}%`,
              backgroundColor: freshness.color,
            },
            isWarning && styles.progressFillWarningGlow,
          ]}
        />
      </View>
      <Text style={[styles.remainingText, { color: palette.textMuted }]}>{remainingLabel}</Text>
    </Pressable>
  );
}

export default function InventoryScreen() {
  const {
    items,
    isLoading,
    error,
    reload,
    retryProfile,
    addItem,
    addManyItems,
    deleteItem,
    updateItem,
    householdLabel,
  } =
    useInventory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ParsedReceiptItem[]>([]);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<InventoryCategory>("Dairy");
  const [editExpiryDate, setEditExpiryDate] = useState(new Date());
  const [isEditDatePickerOpen, setIsEditDatePickerOpen] = useState(false);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const insets = useSafeAreaInsets();
  const { isDark, palette, toggleTheme } = useAppTheme();
  const cardBorderColor = isDark ? "#334155" : "#F1F5F9";

  const emptyState = !isLoading && items.length === 0;

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [items.length]);

  const toManualPayload = (item: ParsedReceiptItem): ManualAddPayload => {
    return {
      name: item.name?.trim() || "Неизвестный товар",
      category: normalizeCategory(item.category),
      quantity: Math.max(1, Number(item.quantity) || 1),
      expiryDate: new Date(
        Date.now() + Math.max(1, Number(item.expiry_days) || 1) * 24 * 60 * 60 * 1000,
      ),
    };
  };

  const handleScanReceipt = async (source: "camera" | "library") => {
    setSubmitError(null);
    try {
      if (source === "camera") {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          setSubmitError("Нужен доступ к камере для съемки чека.");
          return;
        }
      } else {
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libraryPermission.granted) {
          setSubmitError("Нужен доступ к галерее для выбора изображения.");
          return;
        }
      }

      const selected =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 1,
              allowsEditing: false,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 1,
              allowsEditing: false,
              base64: true,
            });

      if (selected.canceled || !selected.assets[0]) {
        return;
      }

      const asset = selected.assets[0];
      if (!asset.base64) {
        throw new Error("Не удалось прочитать изображение. Попробуйте снова.");
      }

      setIsAnalyzingReceipt(true);
      let parsed: ParsedReceiptItem[] = [];
      try {
        parsed = await processReceiptFromBase64(asset.base64, asset.mimeType ?? "image/jpeg");
      } catch (error) {
        console.error("Groq scan failed:", error);
        Alert.alert(
          "Ошибка",
          "Ошибка нейросети. Проверьте ключ API или интернет",
          [{ text: "Отмена", style: "cancel" }],
        );
        return;
      }
      setReceiptItems(parsed);
      setIsModalOpen(false);
      setIsSummaryOpen(true);
    } catch (err) {
      setSubmitError("Ошибка анализа чека.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzingReceipt(false);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditExpiryDate(new Date(item.expiry_date));
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setIsEditDatePickerOpen(false);
  };

  const handleEditDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setIsEditDatePickerOpen(false);
    if (event.type === "set" && selectedDate) {
      setEditExpiryDate(selectedDate);
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    Alert.alert("Подтверждение", "Удалить этот продукт из холодильника?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem(item.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Не удалось удалить продукт.");
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
      },
    ]);
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editName.trim()) {
      return;
    }

    try {
      setIsUpdatingItem(true);
      await updateItem(editingItem.id, {
        name: editName.trim(),
        category: editCategory,
        expiryDate: editExpiryDate,
        quantity: Math.max(1, editingItem.quantity),
      });
      closeEditModal();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не удалось обновить продукт.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUpdatingItem(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Мой Холодильник</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>Контроль свежести продуктов</Text>
          <Text style={[styles.groupLabel, { color: palette.textMuted }]}>{householdLabel}</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={[styles.iconButton, { borderColor: palette.border, backgroundColor: palette.card }]} onPress={() => reload()}>
            <RefreshCcw size={18} color={palette.text} />
          </Pressable>
          <Pressable style={[styles.iconButton, { borderColor: palette.border, backgroundColor: palette.card }]} onPress={toggleTheme}>
            {isDark ? <Sun size={18} color={palette.text} /> : <Moon size={18} color={palette.text} />}
          </Pressable>
          <Pressable
            style={[styles.iconButton, { borderColor: palette.border, backgroundColor: palette.card }]}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await supabase.auth.signOut();
              const keys = await AsyncStorage.getAllKeys();
              const sessionKeys = keys.filter(
                (key) => key.toLowerCase().includes("supabase") || key.includes("fridgemate."),
              );
              if (sessionKeys.length > 0) {
                await AsyncStorage.multiRemove(sessionKeys);
              }
            }}
          >
            <LogOut size={18} color="#E11D48" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={[styles.helperText, { color: palette.textMuted }]}>Загрузка инвентаря...</Text>
        </View>
      ) : null}

      {!isLoading && error ? (
        <View style={[styles.errorCard, { borderColor: "#FCA5A5", backgroundColor: isDark ? "#3F1D1D" : "#FEF2F2" }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={async () => {
              await retryProfile();
            }}
          >
            <RotateCcw size={14} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
      {emptyState ? (
        <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: cardBorderColor }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? "#1E293B" : "#F3F4F6" }]}>
            <Refrigerator size={30} color="#9CA3AF" />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Ваш холодильник пуст</Text>
          <Text style={[styles.helperText, { color: palette.textMuted }]}>Нажмите +, чтобы добавить продукты</Text>
        </View>
      ) : null}

      {!isLoading ? (
        <Pressable
          style={[styles.manualAddButton, { borderColor: palette.border, backgroundColor: palette.card }]}
          onPress={() => setIsModalOpen(true)}
        >
          <Plus size={16} color={palette.text} />
          <Text style={[styles.manualAddButtonText, { color: palette.text }]}>Manual Add</Text>
        </Pressable>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <InventoryRow
              item={item}
              onPress={() => openEditModal(item)}
              onDelete={() => handleDeleteItem(item)}
              palette={palette}
              isDark={isDark}
            />
          )}
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
              tintColor="#111827"
              colors={[palette.accent]}
            />
          }
        />
      ) : null}

      <Pressable
        style={[
          styles.fab,
          {
            bottom: Math.max(insets.bottom + 8, 18),
          },
        ]}
        onPress={() => setIsModalOpen(true)}
      >
        <Plus size={20} color="#FFFFFF" />
      </Pressable>

      <ManualAddModal
        visible={isModalOpen}
        onClose={() => {
          setSubmitError(null);
          setIsModalOpen(false);
        }}
        onSubmit={async (payload) => {
          try {
            setSubmitError(null);
            await addItem(payload);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (err) {
            setSubmitError(
              err instanceof Error ? err.message : "Не удалось добавить продукт.",
            );
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        }}
        onScanReceipt={handleScanReceipt}
        isAnalyzingReceipt={isAnalyzingReceipt}
      />

      <Modal
        visible={Boolean(editingItem)}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.summaryBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.editCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.summaryTitle, { color: palette.text }]}>Редактировать продукт</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Название продукта"
                placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]}
              />

              <Text style={[styles.label, { color: palette.textMuted }]}>Категория</Text>
              <View style={styles.categoryWrap}>
                {Object.keys(CATEGORY_LABELS_RU).map((category) => {
                  const typedCategory = category as InventoryCategory;
                  return (
                    <Pressable
                      key={typedCategory}
                      style={[
                        styles.categoryChip,
                        { borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
                        editCategory === typedCategory && styles.categoryChipActive,
                        editCategory === typedCategory && { borderColor: palette.accent, backgroundColor: isDark ? "#1E293B" : "#FEE2E2" },
                      ]}
                      onPress={() => setEditCategory(typedCategory)}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          editCategory === typedCategory && styles.categoryTextActive,
                          { color: palette.textMuted },
                          editCategory === typedCategory && { color: palette.text },
                        ]}
                      >
                        {CATEGORY_LABELS_RU[typedCategory]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable style={[styles.dateButton, { borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]} onPress={() => setIsEditDatePickerOpen(true)}>
                <Text style={[styles.dateText, { color: palette.text }]}>
                  Годен до: {editExpiryDate.toISOString().slice(0, 10)}
                </Text>
              </Pressable>

              {isEditDatePickerOpen ? (
                <View style={[styles.datePickerWrap, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: palette.border }]}>
                  <DateTimePicker
                    value={editExpiryDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={handleEditDateChange}
                    minimumDate={new Date()}
                    themeVariant={isDark ? "dark" : "light"}
                    textColor={isDark ? "#F9FAFB" : "#111827"}
                  />
                </View>
              ) : null}

              <View style={styles.summaryActions}>
                <Pressable style={styles.summaryCancel} onPress={closeEditModal}>
                  <Text style={styles.summaryCancelText}>Отмена</Text>
                </Pressable>
                <Pressable
                  style={[styles.summarySave, isUpdatingItem && styles.summarySaveDisabled]}
                  onPress={handleUpdateItem}
                  disabled={isUpdatingItem || !editName.trim()}
                >
                  <Text style={styles.summarySaveText}>
                    {isUpdatingItem ? "Сохранение..." : "Сохранить"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={isSummaryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSummaryOpen(false)}
      >
        <View style={styles.summaryBackdrop}>
          <View style={[styles.summaryCard, { backgroundColor: palette.card }]}>
            <View style={styles.summaryHeader}>
              <ScanLine size={18} color="#111827" />
              <Text style={[styles.summaryTitle, { color: palette.text }]}>Итоги сканирования</Text>
            </View>
            <Text style={[styles.summarySubtitle, { color: palette.textMuted }]}>
              Найдено позиций: {receiptItems.length}
            </Text>

            <ScrollView style={styles.summaryList}>
              {receiptItems.map((item, index) => (
                <View key={`${item.name}-${index}`} style={[styles.summaryItem, { borderBottomColor: cardBorderColor }]}>
                  <Text style={[styles.summaryItemName, { color: palette.text }]}>{item.name}</Text>
                  <Text style={[styles.summaryItemMeta, { color: palette.textMuted }]}>
                    {getCategoryLabel(normalizeCategory(item.category))} | Кол-во{" "}
                    {Math.max(1, Number(item.quantity) || 1)} | {Math.max(1, Number(item.expiry_days) || 1)} дн.
                  </Text>
                </View>
              ))}
              {receiptItems.length === 0 ? (
                <Text style={[styles.summaryEmpty, { color: palette.textMuted }]}>
                  На этом чеке не найдено продуктовых позиций.
                </Text>
              ) : null}
            </ScrollView>

            <View style={styles.summaryActions}>
              <Pressable
                style={styles.summaryCancel}
                onPress={() => {
                  setIsSummaryOpen(false);
                  setReceiptItems([]);
                }}
              >
                <Text style={styles.summaryCancelText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.summarySave,
                  receiptItems.length === 0 && styles.summarySaveDisabled,
                ]}
                disabled={receiptItems.length === 0}
                onPress={async () => {
                  setIsSavingReceipt(true);
                  try {
                    await addManyItems(receiptItems.map(toManualPayload));
                    setIsSummaryOpen(false);
                    setReceiptItems([]);
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (err) {
                    setSubmitError(
                      err instanceof Error ? err.message : "Не удалось сохранить товары из чека.",
                    );
                    await Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Error,
                    );
                  } finally {
                    setIsSavingReceipt(false);
                  }
                }}
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.summarySaveText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {isAnalyzingReceipt || isSavingReceipt ? (
        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? "rgba(2,6,23,0.78)" : "rgba(249, 250, 251, 0.9)" }]}>
          <ActivityIndicator size="large" color="#E11D48" />
          <Text style={[styles.loadingOverlayText, { color: palette.text }]}>Синхронизация с ИИ...</Text>
        </View>
      ) : null}
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  groupLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  list: {
    paddingBottom: 116,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "500",
  },
  expiryText: {
    color: "#6B7280",
    fontSize: 12,
  },
  progressTrack: {
    height: 12,
    backgroundColor: "#EEF2F7",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 2,
  },
  remainingText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrackWarningGlow: {
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressFillWarningGlow: {
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  deleteHint: {
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F2",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  deleteHintText: {
    color: "#E11D48",
    fontSize: 11,
    fontWeight: "700",
  },
  manualAddButton: {
    marginBottom: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  manualAddButtonText: {
    fontWeight: "700",
  },
  center: {
    marginTop: 36,
    alignItems: "center",
    gap: 8,
  },
  emptyCard: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    gap: 10,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  helperText: {
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  errorText: {
    color: "#B91C1C",
    marginBottom: 8,
    fontWeight: "500",
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    padding: 12,
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#E11D48",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  fab: {
    position: "absolute",
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(249, 250, 251, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingOverlayText: {
    color: "#111827",
    fontWeight: "600",
  },
  summaryBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.28)",
    justifyContent: "center",
    padding: 20,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  editCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    gap: 10,
  },
  datePickerWrap: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 15,
  },
  label: {
    color: "#374151",
    fontWeight: "600",
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipActive: {
    borderColor: "#111827",
    backgroundColor: "#F3F4F6",
  },
  categoryText: {
    color: "#6B7280",
    fontSize: 13,
  },
  categoryTextActive: {
    color: "#111827",
    fontWeight: "600",
  },
  dateButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateText: {
    color: "#111827",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  summarySubtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  summaryList: {
    maxHeight: 280,
  },
  summaryItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 10,
  },
  summaryItemName: {
    color: "#111827",
    fontWeight: "600",
  },
  summaryItemMeta: {
    color: "#6B7280",
    marginTop: 2,
    fontSize: 12,
  },
  summaryEmpty: {
    color: "#6B7280",
    paddingVertical: 12,
    textAlign: "center",
  },
  summaryActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  summaryCancel: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryCancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  summarySave: {
    borderRadius: 12,
    backgroundColor: "#E11D48",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summarySaveDisabled: {
    opacity: 0.45,
  },
  summarySaveText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
