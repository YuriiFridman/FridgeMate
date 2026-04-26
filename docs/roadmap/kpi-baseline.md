# KPI Baseline (Month 0)

## Product KPIs
- Weekly Active Households (WAH): baseline TBD (set from Supabase weekly query).
- Recipe to Shopping Conversion: baseline TBD.
- Join Family Success Rate: baseline TBD.
- Inventory Update Completion Rate: baseline TBD.

## UX KPIs
- Auth to First Inventory Item Time: baseline TBD.
- Join Family Drop-off Rate: baseline TBD.
- Shopping Item Toggle Success (without rollback): baseline TBD.
- AI Flow Completion (receipt scan -> saved items): baseline TBD.

## Technical KPIs
- P0 error rate (auth/rls/network): baseline TBD.
- Web bundle size (JS/CSS): read from `npm run perf:budget`.
- Web smoke pass rate: read from `npm run smoke:web`.
- Realtime sync delay (inventory/shopping): baseline TBD from logs.

## Data Collection Plan
- Add client telemetry events (screen_enter, action_success, action_error).
- Add server-side aggregation job (daily rollup).
- Store KPI snapshots weekly in `docs/roadmap/kpi-snapshots/`.

## Month 1 Targets
- Join Family Success Rate >= 95%.
- Recipe to Shopping Conversion +15% from baseline.
- P0 error rate -40% from baseline.
- Web bundle within budget for every main branch build.
