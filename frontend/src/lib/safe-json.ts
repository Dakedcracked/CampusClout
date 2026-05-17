/**
 * Safely parse JSON response from fetch calls
 * Handles cases where the server returns non-JSON content
 */
export async function safeJsonParse<T = Record<string, unknown>>(
  response: Response
): Promise<T | null> {
  try {
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return null;
    }
    return await response.json() as T;
  } catch {
    return null;
  }
}

/**
 * Extract error message from response
 * Handles various error response formats
 */
export function getErrorMessage(
  data: Record<string, unknown> | null,
  statusText: string
): string {
  if (!data) return statusText || "Unknown error";
  if (typeof data === "string") return data;
  if ("detail" in data) return String(data.detail);
  if ("message" in data) return String(data.message);
  if ("error" in data) return String(data.error);
  return statusText || "Unknown error";
}
