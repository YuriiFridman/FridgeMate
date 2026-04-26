import { supabase } from "../lib/supabase";
import { toDataError } from "../lib/dataErrors";
import { withRetry } from "../lib/retry";
import type { FamilyContext, FamilyRole } from "../lib/family";

export async function getFamilyContextData(): Promise<FamilyContext | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await withRetry(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    });

    if (!profile?.household_id) return null;

    const familyId = String(profile.household_id);
    const household = await withRetry(async () => {
      const { data, error } = await supabase
        .from("households")
        .select("name, created_by")
        .eq("id", familyId)
        .maybeSingle<{ name: string; created_by: string }>();
      if (error) throw error;
      return data;
    });

    const profileRole = String((profile as { role?: unknown }).role ?? "Member");
    const normalizedRole = profileRole === "Admin" ? "Admin" : "Member";
    const role: FamilyRole = household?.created_by === user.id ? "Owner" : normalizedRole;

    return {
      userId: user.id,
      familyId,
      familyName: household?.name ?? "My Family",
      role,
    };
  } catch (error) {
    throw toDataError(error, "Не удалось загрузить контекст семьи.");
  }
}
