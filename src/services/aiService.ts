import { consumeAiCallOrThrow } from "../lib/usageLimits";

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  category: string;
  expiry_days: number;
}

export interface GeneratedRecipe {
  title: string;
  ingredients: string[];
  steps: string;
  time: string;
}

export interface EventDish {
  title: string;
  description: string;
}

export interface WeeklyPlanDay {
  day: string;
  title: string;
  reason: string;
  time: string;
}

const RECEIPT_PROMPT =
  'Ты — шеф-повар. 1. Переводи все продукты на русский. 2. СТРОГО удаляй Pfand и любые позиции тары. 3. Группируй похожие товары. Проанализируй чек и верни JSON {"items": [...]} без лишнего текста. Для каждого товара обязательно укажи fields: name, quantity, category, expiry_days.';

const PFAND_PATTERN = /(pfand|pfandwert|leergut|bottle\s*deposit)/i;

function stripMarkdownCodeBlocks(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

function extractJsonObjectText(text: string): string {
  const trimmed = stripMarkdownCodeBlocks(text);
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch?.[0] ?? trimmed;
}

function parseAiReceiptResponse(text: string): ParsedReceiptItem[] {
  const jsonPayload = extractJsonObjectText(text);

  let data: unknown;
  try {
    data = JSON.parse(jsonPayload);
  } catch {
    throw new Error("Ответ нейросети не содержит корректный JSON.");
  }

  const parsed = (data as { items?: unknown })?.items ?? data;
  const normalized = Array.isArray(parsed) ? parsed : [parsed];

  if (!normalized.length) {
    return [];
  }

  return normalized
    .map((item) => {
    const safeItem = (item ?? {}) as Partial<ParsedReceiptItem>;
    return {
      name: String(safeItem.name ?? "").trim(),
      category: String(safeItem.category ?? "Other").trim() || "Other",
      quantity: Math.max(1, Number(safeItem.quantity) || 1),
      expiry_days: Math.max(1, Math.round(Number(safeItem.expiry_days) || 1)),
    };
    })
    .filter((item) => item.name.length > 0 && !PFAND_PATTERN.test(item.name));
}

function parseAiRecipeResponse(text: string): GeneratedRecipe[] {
  const jsonPayload = extractJsonObjectText(text);
  const data = JSON.parse(jsonPayload) as { recipes?: unknown } | unknown;
  const parsed = (data as { recipes?: unknown })?.recipes ?? data;
  const normalized = Array.isArray(parsed) ? parsed : [parsed];

  return normalized
    .map((recipe) => {
      const safeRecipe = (recipe ?? {}) as Partial<GeneratedRecipe>;
      return {
        title: String(safeRecipe.title ?? "").trim(),
        ingredients: Array.isArray(safeRecipe.ingredients)
          ? safeRecipe.ingredients
              .map((item) => String(item ?? "").trim())
              .filter((item) => item.length > 0)
          : [],
        steps: Array.isArray(safeRecipe.steps)
          ? safeRecipe.steps
              .map((item) => String(item ?? "").trim())
              .filter((item) => item.length > 0)
              .join("\n")
          : String(safeRecipe.steps ?? "").trim(),
        time: String((safeRecipe as { time?: unknown }).time ?? "").trim() || "20 мин",
      };
    })
    .filter((recipe) => recipe.title.length > 0 && recipe.steps.length > 0);
}

function parseEventMenuResponse(text: string): EventDish[] {
  const jsonPayload = extractJsonObjectText(text);
  const data = JSON.parse(jsonPayload) as { menu?: unknown } | unknown;
  const parsed = (data as { menu?: unknown })?.menu ?? data;
  const normalized = Array.isArray(parsed) ? parsed : [parsed];

  return normalized
    .map((dish) => {
      const safeDish = (dish ?? {}) as { title?: unknown; description?: unknown };
      return {
        title: String(safeDish.title ?? "").trim(),
        description: String(safeDish.description ?? "").trim(),
      };
    })
    .filter((dish) => dish.title.length > 0);
}

function parseWeeklyPlanResponse(text: string): WeeklyPlanDay[] {
  const jsonPayload = extractJsonObjectText(text);
  const data = JSON.parse(jsonPayload) as { plan?: unknown } | unknown;
  const parsed = (data as { plan?: unknown })?.plan ?? data;
  const normalized = Array.isArray(parsed) ? parsed : [parsed];

  return normalized
    .map((entry) => {
      const safe = (entry ?? {}) as {
        day?: unknown;
        title?: unknown;
        reason?: unknown;
        time?: unknown;
      };
      return {
        day: String(safe.day ?? "").trim(),
        title: String(safe.title ?? "").trim(),
        reason: String(safe.reason ?? "").trim(),
        time: String(safe.time ?? "30 мин").trim() || "30 мин",
      };
    })
    .filter((entry) => entry.day.length > 0 && entry.title.length > 0);
}

function normalizeImagePayload(imageBase64: string, mimeType = "image/jpeg") {
  const cleanBase64 = imageBase64.split(",")[1] || imageBase64;
  return {
    data: cleanBase64.trim(),
    mimeType: mimeType || "image/jpeg",
  };
}

export async function processReceipt(
  base64Image: string,
  mimeType = "image/jpeg",
): Promise<ParsedReceiptItem[]> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  const defaultModel = "meta-llama/llama-4-scout-17b-16e-instruct";
  const configuredModel = process.env.EXPO_PUBLIC_GROQ_MODEL || defaultModel;
  if (!apiKey) {
    throw new Error("Не найден EXPO_PUBLIC_GROQ_API_KEY");
  }
  await consumeAiCallOrThrow();

  const imagePayload = normalizeImagePayload(base64Image, mimeType);
  const imageDataUrl = `data:${imagePayload.mimeType || "image/jpeg"};base64,${imagePayload.data}`;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";
  const buildPayload = (model: string) => ({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: RECEIPT_PROMPT },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  console.log("Groq Request Payload:", {
    model: configuredModel,
    mimeType: imagePayload.mimeType || "image/jpeg",
    base64Length: imagePayload.data.length,
    base64Preview: `${imagePayload.data.slice(0, 48)}...`,
  });

  const request = async (model: string) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(model)),
    });

    const rawBody = await response.text();
    let responseJson: {
      choices?: Array<{
        message?: { content?: string };
      }>;
      error?: { message?: string; code?: string };
    } = {};

    try {
      responseJson = JSON.parse(rawBody) as typeof responseJson;
    } catch {
      responseJson = {};
    }

    return { response, responseJson, rawBody };
  };

  let { response, responseJson, rawBody } = await request(configuredModel);

  const isDecommissioned =
    !response.ok &&
    (responseJson.error?.code === "model_decommissioned" ||
      responseJson.error?.message?.toLowerCase().includes("decommissioned"));

  if (isDecommissioned && configuredModel !== defaultModel) {
    console.warn(`Groq model ${configuredModel} недоступна, пробуем ${defaultModel}`);
    ({ response, responseJson, rawBody } = await request(defaultModel));
  }

  if (!response.ok) {
    console.error("Groq API Error Response:", {
      status: response.status,
      statusText: response.statusText,
      rawBody,
    });
    throw new Error(responseJson.error?.message ?? "Ошибка запроса к Groq.");
  }

  const responseText = responseJson.choices?.[0]?.message?.content ?? "";
  console.log("Groq Response:", responseText);

  return parseAiReceiptResponse(responseText);
}

export async function processReceiptFromBase64(
  base64: string,
  mimeType = "image/jpeg",
): Promise<ParsedReceiptItem[]> {
  return processReceipt(base64, mimeType);
}

export async function generateRecipes(
  products: string[],
  options?: { preferencesHint?: string },
): Promise<GeneratedRecipe[]> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  const model = process.env.EXPO_PUBLIC_GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  if (!apiKey) {
    throw new Error("Не найден EXPO_PUBLIC_GROQ_API_KEY");
  }
  await consumeAiCallOrThrow();

  const endpoint = "https://api.groq.com/openai/v1/chat/completions";
  const productList = products.length > 0 ? products.join(", ") : "нет доступных продуктов";
  const preferencesHint = options?.preferencesHint ? `Учитывай предпочтения: ${options.preferencesHint}. ` : "";
  const recipePrompt = `У меня есть: ${productList}. ${preferencesHint}Предложи 3 рецепта. Один — максимально быстрый, второй — из продуктов, которые скоро испортятся, третий — необычный. Верни JSON: {"recipes": [{"title": "...", "ingredients": ["..."], "steps": "...", "time": "20 мин"}]}.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: recipePrompt }],
      response_format: { type: "json_object" },
    }),
  });

  const rawBody = await response.text();
  let responseJson: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } = {};
  try {
    responseJson = JSON.parse(rawBody) as typeof responseJson;
  } catch {
    responseJson = {};
  }

  if (!response.ok) {
    throw new Error(responseJson.error?.message ?? "Ошибка генерации рецептов.");
  }

  const responseText = responseJson.choices?.[0]?.message?.content ?? "";
  return parseAiRecipeResponse(responseText);
}

export async function generateEventMenu(
  peopleCount: number,
  options?: { budgetEuro?: number | null; preferencesHint?: string },
): Promise<EventDish[]> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  const model = process.env.EXPO_PUBLIC_GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  if (!apiKey) {
    throw new Error("Не найден EXPO_PUBLIC_GROQ_API_KEY");
  }
  await consumeAiCallOrThrow();

  const budgetHint =
    typeof options?.budgetEuro === "number" && options.budgetEuro > 0
      ? `Ориентируйся на общий бюджет ${Math.round(options.budgetEuro)} евро.`
      : "";
  const preferencesHint = options?.preferencesHint
    ? `Учитывай предпочтения: ${options.preferencesHint}.`
    : "";
  const prompt =
    `Нужно составить полноценный праздничный ужин для ${Math.max(1, peopleCount)} человек. ` +
    `${budgetHint} ` +
    `${preferencesHint} ` +
    `Игнорируй холодильник и доступные продукты. ` +
    `СТРОГИЕ ПРАВИЛА МЕНЮ: ` +
    `1) Обязательно 2 салата: один сытный и один свежий. ` +
    `2) Горячее: ИЛИ Shashlik, ИЛИ Grilled Steaks (не оба сразу). ` +
    `3) Обязательно добавь закуски. ` +
    `4) Добавь гарнир и соус/дип, чтобы ужин был полноценным. ` +
    `5) Итог: 6-8 позиций меню. ` +
    `Верни только JSON формата {"menu":[{"title":"...","description":"..."}]}.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  const rawBody = await response.text();
  let responseJson: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } = {};
  try {
    responseJson = JSON.parse(rawBody) as typeof responseJson;
  } catch {
    responseJson = {};
  }

  if (!response.ok) {
    throw new Error(responseJson.error?.message ?? "Ошибка генерации меню.");
  }

  const responseText = responseJson.choices?.[0]?.message?.content ?? "";
  return parseEventMenuResponse(responseText);
}

export async function generateWeeklyPlan(
  products: string[],
  options?: { preferencesHint?: string },
): Promise<WeeklyPlanDay[]> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  const model = process.env.EXPO_PUBLIC_GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  if (!apiKey) {
    throw new Error("Не найден EXPO_PUBLIC_GROQ_API_KEY");
  }
  await consumeAiCallOrThrow();

  const productList = products.length > 0 ? products.join(", ") : "продукты не указаны";
  const preferencesHint = options?.preferencesHint ? `Учитывай предпочтения: ${options.preferencesHint}. ` : "";
  const prompt =
    `Составь недельный план ужинов на 7 дней на основе продуктов: ${productList}. ` +
    preferencesHint +
    `Приоритет: сначала использовать скоропортящиеся продукты. ` +
    `Верни только JSON: {"plan":[{"day":"Понедельник","title":"...","reason":"почему это блюдо подходит по срокам","time":"25 мин"}]}.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  const rawBody = await response.text();
  let responseJson: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } = {};
  try {
    responseJson = JSON.parse(rawBody) as typeof responseJson;
  } catch {
    responseJson = {};
  }

  if (!response.ok) {
    throw new Error(responseJson.error?.message ?? "Ошибка генерации недельного плана.");
  }

  const responseText = responseJson.choices?.[0]?.message?.content ?? "";
  return parseWeeklyPlanResponse(responseText);
}

export function compareIngredientsWithInventory(
  ingredients: string[],
  inventory: string[],
): { inStock: string[]; missing: string[] } {
  const normalizeFoodName = (value: string) =>
    value
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/\d+([.,]\d+)?\s*(г|гр|кг|мл|л|шт|шт\.|pcs|pc)\b/gi, " ")
      .replace(/[^a-zа-яё\s-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedInventory = inventory
    .map((item) => normalizeFoodName(item))
    .filter((item) => item.length > 0);
  const uniqueIngredients = Array.from(
    new Set(ingredients.map((ingredient) => ingredient.trim()).filter(Boolean)),
  );

  const inStock: string[] = [];
  const missing: string[] = [];

  uniqueIngredients.forEach((ingredient) => {
    const normalized = normalizeFoodName(ingredient);
    if (!normalized) return;

    const ingredientTokens = normalized.split(" ").filter((token) => token.length >= 4);
    const exists = normalizedInventory.some(
      (item) => {
        if (item === normalized) return true;
        if (normalized.length >= 5 && item.includes(normalized)) return true;
        if (item.length >= 5 && normalized.includes(item)) return true;

        const itemTokens = item.split(" ").filter((token) => token.length >= 4);
        const overlap = ingredientTokens.filter((token) => itemTokens.includes(token)).length;
        return overlap >= Math.min(ingredientTokens.length, 2) && overlap > 0;
      },
    );
    if (exists) {
      inStock.push(ingredient);
    } else {
      missing.push(ingredient);
    }
  });

  return { inStock, missing };
}

export { RECEIPT_PROMPT };
