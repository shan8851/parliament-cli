import { CommanderError } from "commander";
import { ZodError } from "zod";

export type AppErrorCode =
  | "AMBIGUOUS_QUERY"
  | "AUTH_ERROR"
  | "INTERNAL_ERROR"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_API_ERROR";

const EXIT_CODE_BY_ERROR: Record<AppErrorCode, number> = {
  AMBIGUOUS_QUERY: 2,
  AUTH_ERROR: 3,
  INTERNAL_ERROR: 4,
  INVALID_INPUT: 2,
  NOT_FOUND: 2,
  RATE_LIMITED: 3,
  UPSTREAM_API_ERROR: 3
};

const RETRYABLE_CODES = new Set<AppErrorCode>(["RATE_LIMITED", "UPSTREAM_API_ERROR"]);

export interface AppError extends Error {
  code: AppErrorCode;
  details?: unknown;
  exitCode: number;
  retryable: boolean;
}

export const createAppError = (
  code: AppErrorCode,
  message: string,
  details?: unknown
): AppError => {
  const error = new Error(message) as AppError;
  error.code = code;
  error.details = details;
  error.exitCode = EXIT_CODE_BY_ERROR[code];
  error.retryable = RETRYABLE_CODES.has(code);
  return error;
};

export const isAppError = (error: unknown): error is AppError =>
  error instanceof Error &&
  "code" in error &&
  "exitCode" in error &&
  "retryable" in error;

const commanderMessage = (message: string): string => message.replace(/^error:\s*/u, "");

export const toAppError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof CommanderError) {
    return createAppError("INVALID_INPUT", commanderMessage(error.message));
  }

  if (error instanceof ZodError) {
    return createAppError(
      "UPSTREAM_API_ERROR",
      "Received an unexpected response shape from an upstream API.",
      {
        issues: error.issues
      }
    );
  }

  if (error instanceof Error) {
    return createAppError("INTERNAL_ERROR", error.message);
  }

  return createAppError("INTERNAL_ERROR", "An unknown internal error occurred.");
};
