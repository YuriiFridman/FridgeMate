export type InventoryCategory =
  | "Dairy"
  | "Meat"
  | "Vegetables"
  | "Fruits"
  | "Bakery"
  | "Frozen"
  | "Pantry"
  | "Beverages"
  | "Other";

export type InventoryStatus = "fresh" | "expiring_soon" | "expired";

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  household_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  household_id: string;
  created_by: string;
  name: string;
  category: InventoryCategory;
  expiry_date: string;
  quantity: number;
  status: InventoryStatus;
  created_at: string;
  updated_at: string;
}

export interface ManualAddPayload {
  name: string;
  category: InventoryCategory;
  expiryDate: Date;
  quantity: number;
}
