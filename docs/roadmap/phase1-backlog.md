# Phase 1 Backlog (Weeks 1-6)

## Epic A: Core Flow Reliability
- A1: Harden household switch/join flow (`src/lib/userSetup.ts`, `src/screens/ProfileScreen.tsx`).
- A2: Stabilize inventory realtime and dedupe refetch (`src/hooks/useInventory.ts`).
- A3: Stabilize shopping realtime and optimistic toggle rollback (`src/screens/ShoppingScreen.tsx`).
- A4: Unify error mapping in data layer (`src/lib/dataErrors.ts`, `src/repositories/*`).

## Epic B: Daily Usage Flow
- B1: Batch operations in inventory (multi-delete, multi-mark consumed).
- B2: Receipt scan review step before save (`src/components/ManualAddModal.tsx`, `src/screens/InventoryScreen.tsx`).
- B3: Recipe cooked flow -> one batch inventory mutation (`src/screens/RecipeScreen.tsx`).
- B4: Better loading/empty/error UX states on all core screens.

## Epic C: UX Foundation
- C1: Tokenized spacing/radius/typography (`src/theme/appTheme.tsx`).
- C2: Shared primitives for surface, buttons, and input states (`src/components`).
- C3: Normalize screen container widths and responsive rules (all `src/screens/*.tsx`).
- C4: Accessibility pass (touch targets, contrast, labels).

## Definition of Done (Phase 1)
- All core paths covered by smoke tests (`auth`, `join family`, `inventory`, `shopping`).
- No new critical lint/type issues in changed modules.
- KPI instrumentation for key actions is present and documented.
- Release notes prepared for each Phase 1 milestone PR.
