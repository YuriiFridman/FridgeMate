import { getFamilyContextData } from "../repositories/familyRepository";

export type FamilyRole = "Owner" | "Admin" | "Member";

export interface FamilyContext {
  userId: string;
  familyId: string;
  familyName: string;
  role: FamilyRole;
}

export async function getFamilyContext(): Promise<FamilyContext | null> {
  return getFamilyContextData();
}
