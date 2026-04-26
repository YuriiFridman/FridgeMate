import { supabase } from "../lib/supabase";
import { toDataError } from "../lib/dataErrors";
import { withRetry } from "../lib/retry";

export interface ProfileSummary {
  id: string;
  household_id: string | null;
  full_name: string | null;
  role?: string | null;
}

export async function getProfileByUserId(userId: string): Promise<ProfileSummary | null> {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, household_id, full_name, role")
        .eq("id", userId)
        .maybeSingle<ProfileSummary>();
      if (error) throw error;
      return data;
    });
  } catch (error) {
    throw toDataError(error, "Не удалось загрузить профиль.");
  }
}

export async function updateProfileName(
  userId: string,
  householdId: string,
  fullName: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", userId)
      .eq("household_id", householdId);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось обновить профиль.");
  }
}

export async function upsertProfile(payload: {
  id: string;
  household_id: string;
  role: "Owner" | "Admin" | "Member";
  full_name: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert(payload);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось обновить семейный профиль.");
  }
}

export async function getProfilesByHousehold(householdId: string): Promise<ProfileSummary[]> {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("household_id", householdId);
      if (error) throw error;
      return (data ?? []) as ProfileSummary[];
    });
  } catch (error) {
    throw toDataError(error, "Не удалось загрузить участников семьи.");
  }
}

export async function updateProfileRole(
  memberId: string,
  householdId: string,
  role: "Admin" | "Member",
): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", memberId)
      .eq("household_id", householdId);
    if (error) throw error;
  } catch (error) {
    throw toDataError(error, "Не удалось изменить роль участника.");
  }
}
