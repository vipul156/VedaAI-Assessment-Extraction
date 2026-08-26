export type ErrorCode =
  | "bad_request"
  | "too_large"
  | "unsupported_media"
  | "job_not_found"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  too_large: 413,
  unsupported_media: 415,
  job_not_found: 404,
  rate_limited: 429,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function errorEnvelope(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

export function toErrorPayload(err: unknown): {
  status: number;
  body: ReturnType<typeof errorEnvelope>;
} {
  if (err instanceof AppError) {
    return { status: err.status, body: errorEnvelope(err.code, err.message) };
  }
  return {
    status: 500,
    body: errorEnvelope("internal", "Something went wrong. Please try again."),
  };
}
