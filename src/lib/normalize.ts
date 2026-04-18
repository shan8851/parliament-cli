import type { BillSummary, DivisionSummary, MemberSummary, QuestionSummary } from "../types.js";

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
  house:
    member.latestHouseMembership?.house === undefined || member.latestHouseMembership?.house === null
      ? null
      : String(member.latestHouseMembership.house),
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
