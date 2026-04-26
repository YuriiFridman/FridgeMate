# Phase 3 Growth Plan (Weeks 15-24)

## Scope
- Personalization engine for dietary preferences and allergies.
- Household insights dashboard (waste, savings, completion trends).
- Foundation for monetization experiments (optional freemium boundary).

## Workstreams

### 1) Personalization
- Add profile preferences schema (`diet`, `allergies`, `excluded_ingredients`).
- Use preferences in recipe/event prompts and ingredient matching.
- Add onboarding/edit UI for preferences in Profile flow.

### 2) Analytics and Insights
- Track events with `trackEvent()` (`src/lib/telemetry.ts`).
- Build weekly aggregate metrics:
  - waste-prone categories;
  - planned vs cooked ratio;
  - shopping completion rate.
- Add insights card set to Profile or new Insights screen.

### 3) Scalability
- Prepare feature flags for premium/advanced modules.
- Add usage limits abstraction (household/member/AI calls).
- Keep all growth features behind gradual rollout toggles.

## Exit Criteria
- Preferences affect generated recipes and shopping suggestions.
- Insights view shows at least 3 actionable metrics.
- Instrumentation coverage for top 10 core user actions.
