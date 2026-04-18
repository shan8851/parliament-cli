import { createAppError } from "./errors.js";

import type { BillSummary, MemberSummary } from "../types.js";

const normalize = (value: string): string => value.trim().toLowerCase();

export const parseQueryOrId = (value: string): { id: number | null; query: string } => {
  const query = value.trim();

  if (query.length === 0) {
    throw createAppError("INVALID_INPUT", "Query must not be empty.");
  }

  if (!/^\d+$/u.test(query)) {
    return {
      id: null,
      query
    };
  }

  const parsedId = Number.parseInt(query, 10);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw createAppError("INVALID_INPUT", "Expected a positive integer id.");
  }

  return {
    id: parsedId,
    query
  };
};

export const resolveBillFromCandidates = (query: string, candidates: BillSummary[]): BillSummary => {
  if (candidates.length === 0) {
    throw createAppError("NOT_FOUND", `No bill matches for "${query}".`);
  }

  if (candidates.length === 1) {
    const [candidate] = candidates;

    if (candidate === undefined) {
      throw createAppError("INTERNAL_ERROR", "Missing bill candidate.");
    }

    return candidate;
  }

  const normalizedQuery = normalize(query);
  const exactMatches = candidates.filter((candidate) => normalize(candidate.shortTitle) === normalizedQuery);

  if (exactMatches.length === 1) {
    const [exactMatch] = exactMatches;

    if (exactMatch === undefined) {
      throw createAppError("INTERNAL_ERROR", "Missing exact bill candidate.");
    }

    return exactMatch;
  }

  throw createAppError(
    "AMBIGUOUS_QUERY",
    `Multiple bills match "${query}". Use a billId with \`parliament bill <billId>\`.`,
    {
      candidates: candidates.slice(0, 10),
      query
    }
  );
};

export const resolveMemberFromCandidates = (
  query: string,
  candidates: MemberSummary[]
): MemberSummary => {
  if (candidates.length === 0) {
    throw createAppError("NOT_FOUND", `No member matches for "${query}".`);
  }

  if (candidates.length === 1) {
    const [candidate] = candidates;

    if (candidate === undefined) {
      throw createAppError("INTERNAL_ERROR", "Missing member candidate.");
    }

    return candidate;
  }

  const normalizedQuery = normalize(query);
  const exactMatches = candidates.filter(
    (candidate) =>
      normalize(candidate.nameDisplayAs) === normalizedQuery ||
      normalize(candidate.nameFullTitle ?? "") === normalizedQuery
  );

  if (exactMatches.length === 1) {
    const [exactMatch] = exactMatches;

    if (exactMatch === undefined) {
      throw createAppError("INTERNAL_ERROR", "Missing exact member candidate.");
    }

    return exactMatch;
  }

  throw createAppError(
    "AMBIGUOUS_QUERY",
    `Multiple members match "${query}". Use a member id with \`parliament member <id>\`.`,
    {
      candidates: candidates.slice(0, 10),
      query
    }
  );
};
