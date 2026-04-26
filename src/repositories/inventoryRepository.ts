import { supabase } from "../lib/supabase";
import { toDataError } from "../lib/dataErrors";
import { withRetry } from "../lib/retry";
import type { InventoryCategory, InventoryItem, InventoryStatus } from "../types/inventory";

interface InventoryInsertPayload {
  householdId: string;
  userId: string;
  name: string;
  category: InventoryCategory;
  expiryDateIso: string;
  quantity: number;
  status: InventoryStatus;
}

export async function getInventoryByHousehold(
  householdId: string,
): Promise<InventoryItem[]> {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("household_id", householdId)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    });
  } catch (error) {
    throw toDataError(error, "Не удалось загрузить инвентарь.");
  }
}

export async function insertInventoryItem(payload: InventoryInsertPayload): Promise<void> {
  try {
    const { error } = await supabase.from("inventory").insert({
      household_id: payload.householdId,
      created_by: payload.userId,
      name: payload.name.trim(),
      category: payload.category,
      expiry_date: payload.expiryDateIso,
      quantity: payload.quantity,
      status: payload.status,
    });
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось добавить продукт.");
  }
}

export async function insertInventoryItems(
  payloads: InventoryInsertPayload[],
): Promise<void> {
  try {
    const rows = payloads.map((payload) => ({
      household_id: payload.householdId,
      created_by: payload.userId,
      name: payload.name.trim(),
      category: payload.category,
      expiry_date: payload.expiryDateIso,
      quantity: payload.quantity,
      status: payload.status,
    }));
    const { error } = await supabase.from("inventory").insert(rows);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось добавить продукты.");
  }
}

export async function updateInventoryItem(
  itemId: string,
  payload: {
    name: string;
    category: InventoryCategory;
    expiryDateIso: string;
    quantity: number;
    status: InventoryStatus;
  },
): Promise<void> {
  try {
    const { error } = await supabase
      .from("inventory")
      .update({
        name: payload.name.trim(),
        category: payload.category,
        expiry_date: payload.expiryDateIso,
        quantity: payload.quantity,
        status: payload.status,
      })
      .eq("id", itemId);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось обновить продукт.");
  }
}

export async function deleteInventoryItems(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  try {
    const { error } = await supabase.from("inventory").delete().in("id", itemIds);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось удалить продукты.");
  }
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  return deleteInventoryItems([itemId]);
}
