import { supabase } from "../lib/supabase";

export interface FamilyInsights {
  inventoryCount: number;
  shoppingOpenCount: number;
  shoppingDoneCount: number;
}

export async function getFamilyInsights(familyId: string): Promise<FamilyInsights> {
  const [inventoryRes, shoppingOpenRes, shoppingDoneRes] = await Promise.all([
    supabase.from("inventory").select("id", { count: "exact", head: true }).eq("household_id", familyId),
    supabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("is_bought", false),
    supabase
      .from("shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("is_bought", true),
  ]);

  return {
    inventoryCount: inventoryRes.count ?? 0,
    shoppingOpenCount: shoppingOpenRes.count ?? 0,
    shoppingDoneCount: shoppingDoneRes.count ?? 0,
  };
}
