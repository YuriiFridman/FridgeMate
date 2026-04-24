const DAY_MS = 24 * 60 * 60 * 1000;

export interface FreshnessResult {
  percentage: number;
  color: string;
  remainingDays: number;
}

export const FRESHNESS_COLORS = {
  good: "#22C55E",
  warning: "#FACC15",
  danger: "#EF4444",
} as const;

export function calculateFreshness(
  expiryDate: string | Date,
  createdAt?: string | Date,
): FreshnessResult {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const baseline = createdAt ? new Date(createdAt) : now;

  if (Number.isNaN(expiry.getTime())) {
    return { percentage: 0, color: FRESHNESS_COLORS.danger, remainingDays: 0 };
  }

  const totalLifetime = Math.max(
    1,
    Math.ceil((expiry.getTime() - baseline.getTime()) / DAY_MS),
  );
  const remainingDays = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);

  const percentage = Math.max(
    0,
    Math.min(100, Math.round((remainingDays / totalLifetime) * 100)),
  );

  if (remainingDays > 5) {
    return { percentage, color: FRESHNESS_COLORS.good, remainingDays };
  }

  if (remainingDays >= 2) {
    return { percentage, color: FRESHNESS_COLORS.warning, remainingDays };
  }

  return { percentage, color: FRESHNESS_COLORS.danger, remainingDays };
}
