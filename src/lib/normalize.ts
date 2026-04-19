import type { BillSummary, DivisionSummary, MemberSummary, QuestionSummary } from "../types.js";

const HOUSE_LABEL_BY_NUMERIC_CODE: Record<number, string> = {
  1: "Commons",
  2: "Lords"
};

export interface BillApiLike {
  billId: number;
  currentHouse?: string | null | undefined;
  currentStage?: {
    description?: string | null | undefined;
  } | null | undefined;
  isAct: boolean;
  isDefeated: boolean;
  lastUpdate: string;
  shortTitle: string;
}

export interface MemberApiLike {
  id: number;
  latestHouseMembership?: {
    house?: string | number | null | undefined;
  } | null | undefined;
  latestParty?: {
    name?: string | null | undefined;
  } | null | undefined;
  nameDisplayAs: string;
  nameFullTitle?: string | null | undefined;
  thumbnailUrl?: string | null | undefined;
}

export interface QuestionApiLike {
  house: string;
  id: number;
  questionText: string;
  uin: string;
}

export interface DivisionApiLike {
  AyeCount: number;
  Date: string;
  DivisionId: number;
  NoCount: number;
  Number: number;
  Title: string;
}

export const toBillSummary = (bill: BillApiLike): BillSummary => ({
  billId: bill.billId,
  currentHouse: bill.currentHouse ?? null,
  currentStage: bill.currentStage?.description ?? null,
  isAct: bill.isAct,
  isDefeated: bill.isDefeated,
  lastUpdate: bill.lastUpdate,
  shortTitle: bill.shortTitle
});

export const toMemberSummary = (member: MemberApiLike): MemberSummary => ({
  house: normalizeMemberHouse(member.latestHouseMembership?.house),
  id: member.id,
  nameDisplayAs: member.nameDisplayAs,
  nameFullTitle: member.nameFullTitle ?? null,
  party: member.latestParty?.name ?? null,
  thumbnailUrl: member.thumbnailUrl ?? null
});

export const toQuestionSummary = (question: QuestionApiLike): QuestionSummary => ({
  house: question.house,
  id: question.id,
  questionText: question.questionText,
  uin: question.uin
});

export const toDivisionSummary = (division: DivisionApiLike): DivisionSummary => ({
  ayeCount: division.AyeCount,
  date: division.Date,
  divisionId: division.DivisionId,
  noCount: division.NoCount,
  number: division.Number,
  title: division.Title
});

const normalizeMemberHouse = (value: string | number | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number") {
    return HOUSE_LABEL_BY_NUMERIC_CODE[value] ?? String(value);
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  if (trimmedValue === "1") {
    return "Commons";
  }

  if (trimmedValue === "2") {
    return "Lords";
  }

  return trimmedValue;
};
