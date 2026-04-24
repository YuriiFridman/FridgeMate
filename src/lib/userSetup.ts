import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

interface ProfileRow {
  id: string;
  household_id: string | null;
}

interface HouseholdRow {
  id: string;
}

const HOUSEHOLD_CACHE_KEY = "fridgemate.household_id";

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

async function getCachedHouseholdId(): Promise<string | null> {
  return AsyncStorage.getItem(HOUSEHOLD_CACHE_KEY);
}

async function setCachedHouseholdId(householdId: string): Promise<void> {
  await AsyncStorage.setItem(HOUSEHOLD_CACHE_KEY, householdId);
}

export async function getCurrentUserHouseholdId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cachedHouseholdId = await getCachedHouseholdId();
  if (cachedHouseholdId) return cachedHouseholdId;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    if (isRlsRecursionError(error)) {
      return null;
    }
    throw new Error(extractDbErrorMessage(error));
  }

  if (profile?.household_id) {
    await setCachedHouseholdId(profile.household_id);
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

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({
      name: defaultHouseholdName,
      created_by: user.id,
    })
    .select("id")
    .single<HouseholdRow>();

  if (householdError || !household) {
    throw new Error(householdError?.message ?? "Failed to create household.");
  }

  const { error: upsertProfileError } = await supabase.from("profiles").upsert({
    id: user.id,
    household_id: household.id,
    full_name: user.user_metadata?.full_name ?? null,
  });

  if (upsertProfileError) {
    throw new Error(upsertProfileError.message);
  }

  await setCachedHouseholdId(household.id);
  return household.id;
}
