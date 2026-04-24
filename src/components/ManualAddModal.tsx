import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { ScanLine, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/appTheme";
import type { InventoryCategory, ManualAddPayload } from "../types/inventory";

const CATEGORIES: InventoryCategory[] = [
  "Dairy",
  "Meat",
  "Vegetables",
  "Fruits",
  "Bakery",
  "Frozen",
  "Pantry",
  "Beverages",
  "Other",
];

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

interface ManualAddModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: ManualAddPayload) => Promise<void>;
  onScanReceipt: (source: "camera" | "library") => Promise<void>;
  isAnalyzingReceipt?: boolean;
}

export function ManualAddModal({
  visible,
  onClose,
  onSubmit,
  onScanReceipt,
  isAnalyzingReceipt = false,
}: ManualAddModalProps) {
  const insets = useSafeAreaInsets();
  const { isDark, palette } = useAppTheme();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("Dairy");
  const [quantity, setQuantity] = useState("1");
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);

  const canSubmit = useMemo(
    () => name.trim().length > 0 && Number(quantity) > 0,
    [name, quantity],
  );

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        quantity: Math.max(1, Number(quantity)),
        expiryDate,
      });
      setName("");
      setCategory("Dairy");
      setQuantity("1");
      setExpiryDate(new Date());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === "set" && selectedDate) {
      setExpiryDate(selectedDate);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: isDark ? "rgba(2,6,23,0.72)" : "rgba(255,255,255,0.8)" }]}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom + 12, 20),
                backgroundColor: palette.card,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: isDark ? "#475569" : "#D1D5DB" }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.title, { color: palette.text }]}>Добавить вручную</Text>
              <Pressable style={[styles.closeButton, { borderColor: palette.border }]} onPress={onClose}>
                <X size={18} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                placeholder="Название продукта"
                placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
                value={name}
                onChangeText={setName}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]}
              />

              <TextInput
                placeholder="Количество"
                placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]}
              />

              <Text style={[styles.label, { color: isDark ? "#CBD5E1" : "#374151" }]}>Категория</Text>
              <View style={styles.categoryWrap}>
                {CATEGORIES.map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.categoryChip,
                      { borderColor: isDark ? "#475569" : "#D1D5DB", backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
                      category === item && styles.categoryChipActive,
                      category === item && { borderColor: palette.accent, backgroundColor: isDark ? "#1E293B" : "#FEE2E2" },
                    ]}
                    onPress={() => setCategory(item)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        category === item && styles.categoryTextActive,
                        { color: isDark ? "#94A3B8" : "#6B7280" },
                        category === item && { color: palette.text },
                      ]}
                    >
                      {CATEGORY_LABELS_RU[item]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={[styles.dateButton, { borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]} onPress={() => setShowPicker(true)}>
                <Text style={[styles.dateText, { color: palette.text }]}>
                  Годен до: {expiryDate.toISOString().slice(0, 10)}
                </Text>
              </Pressable>

              {showPicker ? (
                <View style={[styles.datePickerWrap, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: palette.border }]}>
                  <DateTimePicker
                    value={expiryDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                    themeVariant={isDark ? "dark" : "light"}
                    textColor={isDark ? "#F9FAFB" : "#111827"}
                  />
                </View>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  style={[styles.scanButton, isAnalyzingReceipt && styles.buttonDisabled]}
                  onPress={() => {
                    setIsSourceMenuOpen((prev) => !prev);
                  }}
                  disabled={isAnalyzingReceipt}
                >
                  {isAnalyzingReceipt ? (
                    <ActivityIndicator size="small" color={palette.text} />
                  ) : (
                    <ScanLine size={16} color={palette.text} />
                  )}
                  <Text style={[styles.scanText, { color: palette.text }]}>
                    {isAnalyzingReceipt ? "Анализирую..." : "Сканировать чек"}
                  </Text>
                </Pressable>
                {isSourceMenuOpen ? (
                  <View style={[styles.scanMenu, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Pressable
                      style={styles.scanMenuItem}
                      onPress={() => {
                        setIsSourceMenuOpen(false);
                        void onScanReceipt("camera");
                      }}
                    >
                      <Text style={[styles.scanMenuText, { color: palette.text }]}>Сделать фото</Text>
                    </Pressable>
                    <Pressable
                      style={styles.scanMenuItem}
                      onPress={() => {
                        setIsSourceMenuOpen(false);
                        void onScanReceipt("library");
                      }}
                    >
                      <Text style={[styles.scanMenuText, { color: palette.text }]}>Выбрать из галереи</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable style={[styles.cancelButton, { borderColor: palette.border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]} onPress={onClose}>
                  <Text style={[styles.cancelText, { color: palette.text }]}>Отмена</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit || isSubmitting || isAnalyzingReceipt}
                >
                  <Text style={styles.submitText}>
                    {isSubmitting ? "Сохранение..." : "Сохранить"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 14,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    marginBottom: 8,
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
  datePickerWrap: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  dateText: {
    color: "#111827",
  },
  actions: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  scanMenu: {
    position: "absolute",
    bottom: 50,
    left: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 20,
  },
  scanMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scanMenuText: {
    color: "#111827",
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  scanButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scanText: {
    color: "#111827",
    fontWeight: "600",
  },
  submitButton: {
    borderRadius: 10,
    backgroundColor: "#E11D48",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
