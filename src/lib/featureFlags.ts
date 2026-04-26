export interface FeatureFlags {
  smartPlanning: boolean;
  profileInsights: boolean;
  premiumLimits: boolean;
}

export const featureFlags: FeatureFlags = {
  smartPlanning: true,
  profileInsights: true,
  premiumLimits: false,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}
