import { createAppError } from "./errors.js";

export const parsePositiveInteger = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw createAppError("INVALID_INPUT", "Expected a positive integer.");
  }

  return parsedValue;
};

export const parseNonNegativeInteger = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw createAppError("INVALID_INPUT", "Expected a non-negative integer.");
  }

  return parsedValue;
};
