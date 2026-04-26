export type DataErrorCode =
  | "auth"
  | "rls"
  | "validation"
  | "network"
  | "not_found"
  | "unknown";

export class DataError extends Error {
  code: DataErrorCode;

  constructor(code: DataErrorCode, message: string) {
    super(message);
    this.name = "DataError";
    this.code = code;
  }
}

export function toDataError(error: unknown, fallbackMessage: string): DataError {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalized = message.toLowerCase();

  if (
    normalized.includes("infinite recursion") ||
    normalized.includes("policy for relation") ||
    normalized.includes("row-level security") ||
    normalized.includes("rls")
  ) {
    return new DataError("rls", message);
  }
  if (
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("fetch")
  ) {
    return new DataError("network", message);
  }
  if (normalized.includes("not found") || normalized.includes("не найден")) {
    return new DataError("not_found", message);
  }
  if (normalized.includes("auth") || normalized.includes("jwt")) {
    return new DataError("auth", message);
  }
  if (normalized.includes("invalid") || normalized.includes("validate")) {
    return new DataError("validation", message);
  }

  return new DataError("unknown", message);
}
