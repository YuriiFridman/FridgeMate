# Design System Spec

## Tokens
- Colors: managed in `palette` (`bg`, `card`, `text`, `textMuted`, `border`, `accent`, `overlay`).
- Spacing scale: `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=24`.
- Radius scale: `sm=8`, `md=12`, `lg=16`, `pill=999`.
- Typography scale: `title=24`, `subtitle=16`, `body=14`, `caption=12`.

## Core Components
- `ScreenContainer`: unified responsive content wrapper for screens.
- `AppCard`: primary surface container with theme-aware border and gloss.
- `PrimaryButton`: consistent accent action button.
- `ScreenHeader`: title/subtitle/family-badge header block.

## Usage Rules
- Every screen uses `SafeAreaView` + `ScreenContainer`.
- Forms use consistent input radius/border and spacing from tokens.
- Empty/loading/error states reuse shared layout spacing.
- New components must consume `useAppTheme()` instead of hardcoded theme constants.

## Next Steps
- Extract shared input component for validation/helper text.
- Add skeleton/loading placeholders with common tokenized geometry.
- Add a visual regression checklist for core screens (Inventory, Shopping, Recipe, Events, Profile).
