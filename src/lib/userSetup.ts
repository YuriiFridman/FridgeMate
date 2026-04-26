import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProfileByUserId, upsertProfile } from "../repositories/profileRepository";
import { supabase } from "./supabase";
import { withRetry } from "./retry";

interface ProfileRow {
  id: string;
  household_id: string | null;
  role?: string | null;
  full_name?: string | null;
}

interface HouseholdRow {
  id: string;
}

const HOUSEHOLD_CACHE_PREFIX = "fridgemate.household_id";

function householdCacheKey(userId: string): string {
  return `${HOUSEHOLD_CACHE_PREFIX}.${userId}`;
}

function extractDbErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown database error");
  }
  return "Unknown database error";
}

export function isRlsRecursionError(error: unknown): boolean {
  const message = extractDbErrorMessage(error).toLowerCase();
  return message.includes("infinite recursion") || message.includes("policy for relation");
}

async function getCachedHouseholdId(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(householdCacheKey(userId));
}

async function setCachedHouseholdId(userId: string, householdId: string): Promise<void> {
  await AsyncStorage.setItem(householdCacheKey(userId), householdId);
}

export async function clearCachedHouseholdId(userId: string): Promise<void> {
  await AsyncStorage.removeItem(householdCacheKey(userId));
}

export async function getCurrentUserHouseholdId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cachedHouseholdId = await getCachedHouseholdId(user.id);
  if (cachedHouseholdId) return cachedHouseholdId;

  let profile: ProfileRow | null = null;
  try {
    profile = (await getProfileByUserId(user.id)) as ProfileRow | null;
  } catch (error) {
    if (isRlsRecursionError(error)) {
      return null;
    }
    throw new Error(extractDbErrorMessage(error));
  }

  if (profile?.household_id) {
    await setCachedHouseholdId(user.id, profile.household_id);
    return profile.household_id;
  }

  return null;
}

export async function ensureCurrentUserSetup(): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) {
    throw new Error("User is not authenticated.");
  }

  const existingHouseholdId = await getCurrentUserHouseholdId();
  if (existingHouseholdId) {
    return existingHouseholdId;
  }

  const defaultHouseholdName = user.email
    ? `${user.email.split("@")[0]}'s Household`
    : "My Household";

  const { data: household, error: householdError } = await withRetry(async () =>
    supabase
      .from("households")
      .insert({
        name: defaultHouseholdName,
        created_by: user.id,
      })
      .select("id")
      .single<HouseholdRow>(),
  );

  if (householdError || !household) {
    throw new Error(householdError?.message ?? "Failed to create household.");
  }

  await upsertProfile({
    id: user.id,
    household_id: household.id,
    role: "Owner",
    full_name: user.user_metadata?.full_name ?? null,
  });

  await setCachedHouseholdId(user.id, household.id);
  return household.id;
}

export function toFamilyInviteCode(householdId: string): string {
  return `FAMILY-${householdId}`;
}

export function parseFamilyInviteCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase();
  if (normalized.startsWith("FAMILY-")) {
    return trimmed.slice(7).trim();
  }
  // Support pasted URLs like https://site/join?code=FAMILY-<id>
  const codeMatch = trimmed.match(/code=([^&]+)/i);
  if (codeMatch?.[1]) {
    const decoded = decodeURIComponent(codeMatch[1]).trim();
    const decodedUpper = decoded.toUpperCase();
    if (decodedUpper.startsWith("FAMILY-")) {
      return decoded.slice(7).trim();
    }
    return decoded;
  }
  return trimmed;
}

export async function joinFamilyByInviteCode(code: string): Promise<void> {
  const targetFamilyId = parseFamilyInviteCode(code);
  if (!targetFamilyId) {
    throw new Error("Введите корректный код семьи.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error(authError?.message ?? "Пользователь не авторизован.");
  }

  const { data: targetHousehold, error: targetError } = await supabase
    .from("households")
    .select("id")
    .eq("id", targetFamilyId)
    .maybeSingle();
  if (targetError || !targetHousehold) {
    throw new Error("Семья с таким кодом не найдена.");
  }

  const currentProfile = (await getProfileByUserId(user.id)) as ProfileRow | null;

  const oldFamilyId = currentProfile?.household_id ?? null;
  if (oldFamilyId === targetFamilyId) {
    await setCachedHouseholdId(user.id, targetFamilyId);
    return;
  }

  await upsertProfile({
    id: user.id,
    household_id: targetFamilyId,
    role: "Member",
    full_name: currentProfile?.full_name ?? user.user_metadata?.full_name ?? null,
  });

  // Verify that profile now points to the target family.
  const { data: verificationProfile, error: verificationError } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  if (verificationError) {
    throw new Error(verificationError.message);
  }
  if (verificationProfile?.household_id !== targetFamilyId) {
    throw new Error(
      "Не удалось сменить семью. Проверьте RLS-политики для обновления profiles.household_id.",
    );
  }

  if (oldFamilyId) {
    const { data: oldFamily } = await supabase
      .from("households")
      .select("created_by")
      .eq("id", oldFamilyId)
      .maybeSingle<{ created_by: string }>();

    if (oldFamily?.created_by === user.id) {
      await supabase.from("households").delete().eq("id", oldFamilyId);
    }
  }

  await setCachedHouseholdId(user.id, targetFamilyId);
}
