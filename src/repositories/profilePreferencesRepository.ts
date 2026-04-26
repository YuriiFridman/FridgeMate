import { supabase } from "../lib/supabase";

export interface ProfilePreferences {
  diet: string | null;
  allergies: string[];
  excluded_ingredients: string[];
}

const DEFAULT_PREFERENCES: ProfilePreferences = {
  diet: null,
  allergies: [],
  excluded_ingredients: [],
};

export async function getCurrentUserPreferences(): Promise<ProfilePreferences> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFERENCES;

  const { data } = await supabase
    .from("profile_preferences")
    .select("diet, allergies, excluded_ingredients")
    .eq("user_id", user.id)
    .maybeSingle<ProfilePreferences>();

  return {
    diet: data?.diet ?? null,
    allergies: data?.allergies ?? [],
    excluded_ingredients: data?.excluded_ingredients ?? [],
  };
}

export async function saveCurrentUserPreferences(
  payload: ProfilePreferences,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profile_preferences").upsert({
    user_id: user.id,
    diet: payload.diet,
    allergies: payload.allergies,
    excluded_ingredients: payload.excluded_ingredients,
    updated_at: new Date().toISOString(),
  });
}
