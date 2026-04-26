type TelemetryPayload = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(event: string, payload: TelemetryPayload = {}): void {
  // Foundation hook for future analytics providers.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] ${event}`, payload);
  }
}
