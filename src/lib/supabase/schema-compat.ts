export function isMissingColumnError(error: any, columns: string[] = []) {
  const message = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const looksLikeMissingColumn =
    message.includes("42703") ||
    message.includes("pgrst204") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find");

  if (!looksLikeMissingColumn) return false;
  if (!columns.length) return true;

  return columns.some((column) => message.includes(column.toLowerCase()));
}
