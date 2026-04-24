import { supabase } from "./supabase";

export type FamilyRole = "Owner" | "Admin" | "Member";

export interface FamilyContext {
  userId: string;
  familyId: string;
  familyName: string;
  role: FamilyRole;
}

export async function getFamilyContext(): Promise<FamilyContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.household_id) {
    return null;
  }

  const familyId = String(profile.household_id);
  const { data: household } = await supabase
    .from("households")
    .select("name, created_by")
    .eq("id", familyId)
    .maybeSingle<{ name: string; created_by: string }>();

  const profileRole = String((profile as { role?: unknown }).role ?? "Member");
  const normalizedRole = profileRole === "Admin" ? "Admin" : "Member";
  const role: FamilyRole =
    household?.created_by === user.id ? "Owner" : normalizedRole;

  return {
    userId: user.id,
    familyId,
    familyName: household?.name ?? "My Family",
    role,
  };
}
