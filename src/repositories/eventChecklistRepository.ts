import AsyncStorage from "@react-native-async-storage/async-storage";

import type { EventChecklistItem } from "../features/smartPlanning";
import { supabase } from "../lib/supabase";

function localChecklistKey(familyId: string) {
  return `fridgemate.events.checklist.${familyId}`;
}

export async function loadEventChecklist(
  familyId: string,
): Promise<EventChecklistItem[] | null> {
  try {
    const { data } = await supabase
      .from("event_checklists")
      .select("items")
      .eq("family_id", familyId)
      .maybeSingle<{ items: EventChecklistItem[] }>();
    if (data?.items) return data.items;
  } catch {
    // Fallback to local storage.
  }

  const local = await AsyncStorage.getItem(localChecklistKey(familyId));
  if (!local) return null;
  try {
    return JSON.parse(local) as EventChecklistItem[];
  } catch {
    return null;
  }
}

export async function saveEventChecklist(
  familyId: string,
  items: EventChecklistItem[],
): Promise<void> {
  await AsyncStorage.setItem(localChecklistKey(familyId), JSON.stringify(items));
  try {
    await supabase.from("event_checklists").upsert({
      family_id: familyId,
      items,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Local save is enough when table is not yet created.
  }
}
