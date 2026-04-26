import AsyncStorage from "@react-native-async-storage/async-storage";

const AI_CALLS_KEY = "fridgemate.ai_calls.daily";
const DAILY_LIMIT_FREE = 60;

interface UsageState {
  day: string;
  count: number;
}

function currentDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function consumeAiCallOrThrow(): Promise<void> {
  const raw = await AsyncStorage.getItem(AI_CALLS_KEY);
  const state: UsageState | null = raw ? (JSON.parse(raw) as UsageState) : null;
  const day = currentDayKey();
  const nextState: UsageState =
    state && state.day === day ? { day, count: state.count + 1 } : { day, count: 1 };

  if (nextState.count > DAILY_LIMIT_FREE) {
    throw new Error(
      "Достигнут дневной лимит AI-запросов для бесплатного плана. Попробуйте позже.",
    );
  }

  await AsyncStorage.setItem(AI_CALLS_KEY, JSON.stringify(nextState));
}
