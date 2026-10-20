export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "upstream_error"
  | "ai_unavailable"
  | "internal";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, "bad_request", message, details);
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
export const upstream = (message: string) => new ApiError(502, "upstream_error", message);

/** Envelope shared by every v1 endpoint. */
export type ApiResponse<T> = { data: T } | { error: { code: ApiErrorCode; message: string; details?: unknown } };
