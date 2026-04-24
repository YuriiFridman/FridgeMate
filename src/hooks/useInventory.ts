import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ensureCurrentUserSetup,
  getCurrentUserHouseholdId,
  isRlsRecursionError,
} from "../lib/userSetup";
import { scheduleExpiryNotification } from "../services/notificationService";
import { supabase } from "../lib/supabase";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryStatus,
  ManualAddPayload,
} from "../types/inventory";

interface UseInventoryResult {
  items: InventoryItem[];
  householdLabel: string;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  retryProfile: () => Promise<void>;
  addItem: (payload: ManualAddPayload) => Promise<void>;
  addManyItems: (payloads: ManualAddPayload[]) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  updateItem: (itemId: string, payload: ManualAddPayload) => Promise<void>;
}

function statusFromExpiry(expiryDate: Date): InventoryStatus {
  const now = new Date();
  const daysLeft = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysLeft < 0) return "expired";
  if (daysLeft <= 2) return "expiring_soon";
  return "fresh";
}

export function useInventory(): UseInventoryResult {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [householdLabel, setHouseholdLabel] = useState("Family: ...");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForHousehold, setIsWaitingForHousehold] = useState(false);
  const [realtimeHouseholdId, setRealtimeHouseholdId] = useState<string | null>(null);
  const channelInstanceId = useRef(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchItems = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setIsWaitingForHousehold(false);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    if (!user) {
      setError("Войдите в аккаунт, чтобы загрузить инвентарь.");
      setIsLoading(false);
      return;
    }

    const householdId = await getCurrentUserHouseholdId();

    if (!householdId) {
      setRealtimeHouseholdId(null);
      setHouseholdLabel("Family: не подключена");
      setIsWaitingForHousehold(true);
      return;
    }
    setRealtimeHouseholdId(householdId);
    const shortId = householdId.slice(0, 8);

    const { data: householdData } = await supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle<{ name: string | null }>();
    const resolvedGroup = householdData?.name?.trim();
    setHouseholdLabel(resolvedGroup ? `Family: ${resolvedGroup}` : `Family ID: ${shortId}`);

    const { data, error: inventoryError } = await supabase
      .from("inventory")
      .select("*")
      .eq("household_id", householdId)
      .order("expiry_date", { ascending: true });

    if (inventoryError) {
      if (isRlsRecursionError(inventoryError)) {
        setError(
          "Обнаружена проблема RLS в базе данных. Обновите SQL-политики и перезапустите приложение.",
        );
      } else {
        setError(inventoryError.message);
      }
    } else {
      setItems((data ?? []) as InventoryItem[]);
    }

    setIsLoading(false);
  }, []);

  const retryProfile = useCallback(async () => {
    setError(null);
    setIsWaitingForHousehold(false);
    await fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchItems().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Не удалось загрузить инвентарь.");
      setIsLoading(false);
    });
  }, [fetchItems]);

  useEffect(() => {
    if (!isWaitingForHousehold) return;

    const timer = setTimeout(() => {
      fetchItems().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить инвентарь.");
        setIsLoading(false);
        setIsWaitingForHousehold(false);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [fetchItems, isWaitingForHousehold]);

  useEffect(() => {
    if (!realtimeHouseholdId) return;

    const channelName = `inventory-realtime-${realtimeHouseholdId}-${channelInstanceId.current}`;
    if (realtimeChannelRef.current) {
      void supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory",
          filter: `household_id=eq.${realtimeHouseholdId}`,
        },
        () => {
          void fetchItems();
        },
      )
      .subscribe();
    realtimeChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
    };
  }, [fetchItems, realtimeHouseholdId]);

  const addItem = useCallback(
    async (payload: ManualAddPayload) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Войдите в аккаунт перед добавлением продуктов.");
      }

      const householdId = await ensureCurrentUserSetup();

      const expiryDateIso = payload.expiryDate.toISOString().slice(0, 10);
      const status = statusFromExpiry(payload.expiryDate);

      const { error: insertError } = await supabase.from("inventory").insert({
        household_id: householdId,
        created_by: user.id,
        name: payload.name.trim(),
        category: payload.category as InventoryCategory,
        expiry_date: expiryDateIso,
        quantity: payload.quantity,
        status,
      });

      if (insertError) {
        if (isRlsRecursionError(insertError)) {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw new Error(insertError.message);
      }

      await scheduleExpiryNotification(payload.name.trim(), payload.expiryDate);

      await fetchItems();
    },
    [fetchItems],
  );

  const addManyItems = useCallback(
    async (payloads: ManualAddPayload[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Войдите в аккаунт перед добавлением продуктов.");
      }

      const householdId = await ensureCurrentUserSetup();

      const rows = payloads.map((payload) => ({
        household_id: householdId,
        created_by: user.id,
        name: payload.name.trim(),
        category: payload.category,
        expiry_date: payload.expiryDate.toISOString().slice(0, 10),
        quantity: Math.max(1, payload.quantity),
        status: statusFromExpiry(payload.expiryDate),
      }));

      const { error: insertError } = await supabase.from("inventory").insert(rows);

      if (insertError) {
        if (isRlsRecursionError(insertError)) {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw new Error(insertError.message);
      }

      await Promise.all(
        payloads.map((payload) =>
          scheduleExpiryNotification(payload.name.trim(), payload.expiryDate),
        ),
      );

      await fetchItems();
    },
    [fetchItems],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      const { error: deleteError } = await supabase.from("inventory").delete().eq("id", itemId);

      if (deleteError) {
        if (isRlsRecursionError(deleteError)) {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw new Error(deleteError.message);
      }

      await fetchItems();
    },
    [fetchItems],
  );

  const updateItem = useCallback(
    async (itemId: string, payload: ManualAddPayload) => {
      const expiryDateIso = payload.expiryDate.toISOString().slice(0, 10);
      const status = statusFromExpiry(payload.expiryDate);

      const { error: updateError } = await supabase
        .from("inventory")
        .update({
          name: payload.name.trim(),
          category: payload.category,
          expiry_date: expiryDateIso,
          quantity: Math.max(1, payload.quantity),
          status,
        })
        .eq("id", itemId);

      if (updateError) {
        if (isRlsRecursionError(updateError)) {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw new Error(updateError.message);
      }

      await fetchItems();
    },
    [fetchItems],
  );

  return useMemo(
    () => ({
      items,
      householdLabel,
      isLoading,
      error,
      reload: fetchItems,
      retryProfile,
      addItem,
      addManyItems,
      deleteItem,
      updateItem,
    }),
    [addItem, addManyItems, deleteItem, error, fetchItems, householdLabel, isLoading, items, retryProfile, updateItem],
  );
}
