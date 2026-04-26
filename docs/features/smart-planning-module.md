# Smart Planning / Collaboration Module

## Implemented in this iteration
- Event checklist generator with interactive completion toggles.
- Budget hinting based on people count (`estimateBudgetBand`).
- Basic shopping categorization for missing ingredients.
- Telemetry hooks for generated menus and shopping sync.

## Code Paths
- `src/features/smartPlanning.ts`
- `src/screens/EventsScreen.tsx`
- `src/lib/telemetry.ts`

## Next iteration
- Persist checklist state per event session.
- Shared family checklist sync via Supabase table.
- Budget-aware prompt refinement for AI menu generation.
