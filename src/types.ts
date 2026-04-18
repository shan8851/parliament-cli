export type OutputMode = "json" | "text";

export interface OutputOptions {
  color?: boolean;
  json?: boolean;
  text?: boolean;
}

export interface PaginationMeta {
  fetchedAll: boolean;
  itemsPerPage: number;
  returnedCount: number;
  startIndex: number;
  totalResults: number | null;
}

export interface SuccessEnvelope<TData> {
  command: string;
  data: TData;
  ok: true;
  requestedAt: string;
  schemaVersion: "1";
}

export interface ErrorEnvelope {
  command: string;
  error: {
    code: string;
    details?: unknown;
    message: string;
    retryable: boolean;
  };
  ok: false;
  requestedAt: string;
  schemaVersion: "1";
}

export interface CommandRuntime {
  fetchImplementation: typeof fetch;
  stdoutIsTTY: boolean;
  writeStderr: (text: string) => void;
  writeStdout: (text: string) => void;
}

export interface BillSummary {
  billId: number;
  shortTitle: string;
  currentHouse: string | null;
  currentStage: string | null;
  isAct: boolean;
  isDefeated: boolean;
  lastUpdate: string;
}

export interface MemberSummary {
  house: string | null;
  id: number;
  nameDisplayAs: string;
  nameFullTitle: string | null;
  party: string | null;
  thumbnailUrl: string | null;
}

export interface DivisionSummary {
  ayeCount: number;
  date: string;
  divisionId: number;
  noCount: number;
  number: number;
  title: string;
}

export interface QuestionSummary {
  house: string;
  id: number;
  questionText: string;
  uin: string;
}
