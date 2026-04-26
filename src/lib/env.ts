let envValidated = false;

export function validateRuntimeEnv(): void {
  if (envValidated) return;
  envValidated = true;

  const required = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  if (!process.env.EXPO_PUBLIC_GROQ_API_KEY) {
    console.warn(
      "EXPO_PUBLIC_GROQ_API_KEY is missing: AI features will be unavailable until configured.",
    );
  }
}
