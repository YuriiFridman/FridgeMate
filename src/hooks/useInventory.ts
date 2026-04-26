import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ensureCurrentUserSetup,
  getCurrentUserHouseholdId,
  isRlsRecursionError,
} from "../lib/userSetup";
import { DataError } from "../lib/dataErrors";
import { scheduleExpiryNotification } from "../services/notificationService";
import { supabase } from "../lib/supabase";
import {
  deleteInventoryItem,
  getInventoryByHousehold,
  insertInventoryItem,
  insertInventoryItems,
  updateInventoryItem,
} from "../repositories/inventoryRepository";
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
  const fetchRequestRef = useRef(0);
  const suppressRealtimeEventsRef = useRef(0);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(async (source: "manual" | "realtime" = "manual") => {
    const requestId = ++fetchRequestRef.current;
    if (source !== "realtime") {
      setError(null);
      setIsLoading(true);
      setIsWaitingForHousehold(false);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      if (requestId !== fetchRequestRef.current) return;
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    if (!user) {
      if (requestId !== fetchRequestRef.current) return;
      setError("Войдите в аккаунт, чтобы загрузить инвентарь.");
      setIsLoading(false);
      return;
    }

    const householdId = await getCurrentUserHouseholdId();

    if (!householdId) {
      if (requestId !== fetchRequestRef.current) return;
      setRealtimeHouseholdId(null);
      setHouseholdLabel("Family: не подключена");
      setIsWaitingForHousehold(true);
      setIsLoading(false);
      return;
    }
    if (requestId !== fetchRequestRef.current) return;
    setRealtimeHouseholdId(householdId);
    const shortId = householdId.slice(0, 8);

    const { data: householdData } = await supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle<{ name: string | null }>();
    if (requestId !== fetchRequestRef.current) return;
    const resolvedGroup = householdData?.name?.trim();
    setHouseholdLabel(resolvedGroup ? `Family: ${resolvedGroup}` : `Family ID: ${shortId}`);

    if (requestId !== fetchRequestRef.current) return;
    try {
      const inventory = await getInventoryByHousehold(householdId);
      if (requestId !== fetchRequestRef.current) return;
      setItems(inventory);
    } catch (inventoryError) {
      if (inventoryError instanceof DataError && inventoryError.code === "rls") {
        setError(
          "Обнаружена проблема RLS в базе данных. Обновите SQL-политики и перезапустите приложение.",
        );
      } else {
        setError(
          inventoryError instanceof Error
            ? inventoryError.message
            : "Не удалось загрузить инвентарь.",
        );
      }
    }

    setIsLoading(false);
  }, []);

  const retryProfile = useCallback(async () => {
    setError(null);
    setIsWaitingForHousehold(false);
    await fetchItems("manual");
  }, [fetchItems]);

  useEffect(() => {
    fetchItems("manual").catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Не удалось загрузить инвентарь.");
      setIsLoading(false);
    });
  }, [fetchItems]);

  useEffect(() => {
    if (!isWaitingForHousehold) return;

    const timer = setTimeout(() => {
      fetchItems("manual").catch((err: unknown) => {
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
          if (suppressRealtimeEventsRef.current > 0) {
            suppressRealtimeEventsRef.current -= 1;
            return;
          }
          if (realtimeDebounceRef.current) {
            clearTimeout(realtimeDebounceRef.current);
          }
          realtimeDebounceRef.current = setTimeout(() => {
            void fetchItems("realtime");
          }, 250);
        },
      )
      .subscribe();
    realtimeChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
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

      try {
        await insertInventoryItem({
          householdId,
          userId: user.id,
          name: payload.name.trim(),
          category: payload.category as InventoryCategory,
          expiryDateIso,
          quantity: payload.quantity,
          status,
        });
      } catch (insertError) {
        if (insertError instanceof DataError && insertError.code === "rls") {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw insertError instanceof Error ? insertError : new Error("Не удалось добавить продукт.");
      }

      await scheduleExpiryNotification(payload.name.trim(), payload.expiryDate);
      suppressRealtimeEventsRef.current += 1;
      await fetchItems("manual");
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

      try {
        await insertInventoryItems(
          payloads.map((payload) => ({
            householdId,
            userId: user.id,
            name: payload.name.trim(),
            category: payload.category,
            expiryDateIso: payload.expiryDate.toISOString().slice(0, 10),
            quantity: Math.max(1, payload.quantity),
            status: statusFromExpiry(payload.expiryDate),
          })),
        );
      } catch (insertError) {
        if (insertError instanceof DataError && insertError.code === "rls") {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw insertError instanceof Error ? insertError : new Error("Не удалось добавить продукты.");
      }

      await Promise.all(
        payloads.map((payload) =>
          scheduleExpiryNotification(payload.name.trim(), payload.expiryDate),
        ),
      );
      suppressRealtimeEventsRef.current += Math.max(1, payloads.length);
      await fetchItems("manual");
    },
    [fetchItems],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      try {
        await deleteInventoryItem(itemId);
      } catch (deleteError) {
        if (deleteError instanceof DataError && deleteError.code === "rls") {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw deleteError instanceof Error ? deleteError : new Error("Не удалось удалить продукт.");
      }

      suppressRealtimeEventsRef.current += 1;
      await fetchItems("manual");
    },
    [fetchItems],
  );

  const updateItem = useCallback(
    async (itemId: string, payload: ManualAddPayload) => {
      const expiryDateIso = payload.expiryDate.toISOString().slice(0, 10);
      const status = statusFromExpiry(payload.expiryDate);

      try {
        await updateInventoryItem(itemId, {
          name: payload.name.trim(),
          category: payload.category,
          expiryDateIso,
          quantity: Math.max(1, payload.quantity),
          status,
        });
      } catch (updateError) {
        if (updateError instanceof DataError && updateError.code === "rls") {
          throw new Error("Обнаружена рекурсия в RLS-политиках. Обновите SQL-политики.");
        }
        throw updateError instanceof Error ? updateError : new Error("Не удалось обновить продукт.");
      }

      suppressRealtimeEventsRef.current += 1;
      await fetchItems("manual");
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
