import { supabase } from "../lib/supabase";
import { toDataError } from "../lib/dataErrors";
import { withRetry } from "../lib/retry";

export interface ShoppingItemRow {
  id: string;
  family_id: string;
  title: string;
  is_bought: boolean;
  created_at?: string;
}

export async function getShoppingItems(familyId: string): Promise<ShoppingItemRow[]> {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("family_id", familyId)
        .order("is_bought", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShoppingItemRow[];
    });
  } catch (error) {
    throw toDataError(error, "Не удалось загрузить список покупок.");
  }
}

export async function addShoppingItem(payload: {
  familyId: string;
  title: string;
  source: string;
}): Promise<void> {
  try {
    const { error } = await supabase.from("shopping_items").insert({
      family_id: payload.familyId,
      title: payload.title.trim(),
      is_bought: false,
      source: payload.source,
    });
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось добавить покупку.");
  }
}

export async function addShoppingItems(
  payloads: Array<{ familyId: string; title: string; source: string }>,
): Promise<void> {
  if (payloads.length === 0) return;
  try {
    const { error } = await supabase.from("shopping_items").insert(
      payloads.map((item) => ({
        family_id: item.familyId,
        title: item.title.trim(),
        is_bought: false,
        source: item.source,
      })),
    );
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось добавить покупки.");
  }
}

export async function updateShoppingBought(
  itemId: string,
  familyId: string,
  isBought: boolean,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("shopping_items")
      .update({ is_bought: isBought })
      .eq("id", itemId)
      .eq("family_id", familyId);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось обновить покупку.");
  }
}

export async function clearBoughtShoppingItems(familyId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("family_id", familyId)
      .eq("is_bought", true);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось удалить отмеченные покупки.");
  }
}
