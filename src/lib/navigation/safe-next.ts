const controlCharacterPattern = /[\u0000-\u001F\u007F]/;

export function safeNextPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    controlCharacterPattern.test(value)
  ) {
    return fallback;
  }

  return value;
}
