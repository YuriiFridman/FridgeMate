export interface EventChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export function buildEventChecklist(peopleCount: number): EventChecklistItem[] {
  const safePeople = Math.max(1, peopleCount);
  return [
    { id: "menu", title: "Утвердить финальное меню", done: false },
    { id: "shopping", title: "Собрать список покупок по блюдам", done: false },
    { id: "prep", title: "Сделать заготовки за день до события", done: false },
    {
      id: "tableware",
      title: `Проверить посуду и приборы на ${safePeople} человек`,
      done: false,
    },
    { id: "timing", title: "Согласовать тайминг готовки и подачи", done: false },
  ];
}

export function estimateBudgetBand(peopleCount: number): { min: number; max: number } {
  const safePeople = Math.max(1, peopleCount);
  const min = safePeople * 12;
  const max = safePeople * 22;
  return { min, max };
}

export function categorizeShoppingItems(items: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {
    "Овощи и фрукты": [],
    "Мясо и рыба": [],
    "Бакалея": [],
    "Прочее": [],
  };

  items.forEach((item) => {
    const value = item.toLowerCase();
    if (/(помидор|огур|салат|лук|карто|яблок|банан|лимон|fruit|vegetable)/.test(value)) {
      buckets["Овощи и фрукты"].push(item);
      return;
    }
    if (/(мяс|кур|рыб|стейк|шашлык|beef|chicken|fish)/.test(value)) {
      buckets["Мясо и рыба"].push(item);
      return;
    }
    if (/(рис|греч|макарон|мук|соус|масл|спец|bread|pasta|rice)/.test(value)) {
      buckets["Бакалея"].push(item);
      return;
    }
    buckets["Прочее"].push(item);
  });

  return buckets;
}
