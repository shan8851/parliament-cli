import { z } from "zod";

import { createAppError } from "./errors.js";

import type { ParliamentCliConfig } from "./config.js";

const BillApiSchema = z
  .object({
    billId: z.number(),
    currentHouse: z.string().nullable().optional(),
    currentStage: z
      .object({
        description: z.string().nullable().optional()
      })
      .nullable()
      .optional(),
    isAct: z.boolean(),
    isDefeated: z.boolean(),
    lastUpdate: z.string(),
    shortTitle: z.string()
  })
  .passthrough();

const BillsSearchResponseSchema = z
  .object({
    items: z.array(BillApiSchema),
    totalResults: z.number().nullable().optional()
  })
  .passthrough();

const MemberValueSchema = z
  .object({
    id: z.number(),
    latestHouseMembership: z
      .object({
        house: z.union([z.string(), z.number()]).nullable().optional()
      })
      .nullable()
      .optional(),
    latestParty: z
      .object({
        name: z.string().nullable().optional()
      })
      .nullable()
      .optional(),
    nameDisplayAs: z.string(),
    nameFullTitle: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional()
  })
  .passthrough();

const MemberSearchResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          value: MemberValueSchema
        })
        .passthrough()
    )
  })
  .passthrough();

const QuestionValueSchema = z
  .object({
    answerText: z.string().nullable().optional(),
    answeringBodyName: z.string().nullable().optional(),
    dateAnswered: z.string().nullable().optional(),
    dateTabled: z.string().nullable().optional(),
    house: z.string(),
    id: z.number(),
    questionText: z.string(),
    uin: z.string()
  })
  .passthrough();

const QuestionsSearchResponseSchema = z
  .object({
    results: z.array(
      z
        .object({
          value: QuestionValueSchema
        })
        .passthrough()
    ),
    totalResults: z.number()
  })
  .passthrough();

const DivisionSchema = z
  .object({
    AyeCount: z.number(),
    Date: z.string(),
    DivisionId: z.number(),
    NoCount: z.number(),
    Number: z.number(),
    Title: z.string()
  })
  .passthrough();

const DivisionSearchResponseSchema = z.array(DivisionSchema);

const httpErrorFromStatus = (status: number, url: string): ReturnType<typeof createAppError> => {
  if (status === 401 || status === 403) {
    return createAppError("AUTH_ERROR", "Upstream API rejected the request.", {
      statusCode: status,
      url
    });
  }

  if (status === 404) {
    return createAppError("NOT_FOUND", "Resource not found.", {
      statusCode: status,
      url
    });
  }

  if (status === 429) {
    return createAppError("RATE_LIMITED", "Upstream API rate limit reached.", {
      statusCode: status,
      url
    });
  }

  if (status >= 500) {
    return createAppError("UPSTREAM_API_ERROR", "Upstream API returned a server error.", {
      statusCode: status,
      url
    });
  }

  return createAppError("UPSTREAM_API_ERROR", "Upstream API request failed.", {
    statusCode: status,
    url
  });
};

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/u, "");

const readJsonWithSchema = async <T>(
  response: Response,
  schema: z.ZodType<T>,
  url: string
): Promise<T> => {
  if (!response.ok) {
    throw httpErrorFromStatus(response.status, url);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw createAppError("UPSTREAM_API_ERROR", "Upstream API returned invalid JSON.", {
      url
    });
  }

  return schema.parse(body);
};

const readText = async (response: Response, url: string): Promise<string> => {
  if (!response.ok) {
    throw httpErrorFromStatus(response.status, url);
  }

  return response.text();
};

const createUrl = (baseUrl: string, path: string, query: Record<string, string | number | undefined>): URL => {
  const url = new URL(path, `${normalizeBaseUrl(baseUrl)}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
};

export interface ParliamentClient {
  getBill: (billId: number) => Promise<z.infer<typeof BillApiSchema>>;
  getDivision: (divisionId: number) => Promise<z.infer<typeof DivisionSchema>>;
  getMember: (memberId: number) => Promise<z.infer<typeof MemberValueSchema>>;
  getQuestion: (questionId: number) => Promise<z.infer<typeof QuestionValueSchema>>;
  getDivisionSearchTotal: (searchTerm: string) => Promise<number | null>;
  searchBills: (input: { searchTerm: string; skip: number; take: number }) => Promise<z.infer<typeof BillsSearchResponseSchema>>;
  searchDivisions: (input: { searchTerm: string; skip: number; take: number }) => Promise<z.infer<typeof DivisionSearchResponseSchema>>;
  searchMembers: (input: { name: string; skip: number; take: number }) => Promise<z.infer<typeof MemberSearchResponseSchema>>;
  searchQuestions: (input: { searchTerm: string; skip: number; take: number }) => Promise<z.infer<typeof QuestionsSearchResponseSchema>>;
}

export const createParliamentClient = (
  config: ParliamentCliConfig,
  fetchImplementation: typeof fetch,
  userAgent: string
): ParliamentClient => {
  const request = async (url: URL): Promise<Response> => {
    try {
      return await fetchImplementation(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        throw createAppError("UPSTREAM_API_ERROR", error.message, {
          url: url.toString()
        });
      }

      throw createAppError("UPSTREAM_API_ERROR", "Failed to reach upstream API.", {
        url: url.toString()
      });
    }
  };

  return {
    async getBill(billId) {
      const url = createUrl(config.billsApiBaseUrl, `/api/v1/Bills/${billId}`, {});
      const response = await request(url);
      return readJsonWithSchema(response, BillApiSchema, url.toString());
    },

    async getDivision(divisionId) {
      const url = createUrl(
        config.commonsVotesApiBaseUrl,
        `/data/division/${divisionId}.json`,
        {}
      );
      const response = await request(url);
      return readJsonWithSchema(response, DivisionSchema, url.toString());
    },

    async getDivisionSearchTotal(searchTerm) {
      const url = createUrl(
        config.commonsVotesApiBaseUrl,
        "/data/divisions.json/searchTotalResults",
        {
          "queryParameters.searchTerm": searchTerm
        }
      );
      const response = await request(url);
      const body = (await readText(response, url.toString())).trim();

      if (body.length === 0) {
        return null;
      }

      const parsedValue = Number.parseInt(body, 10);

      return Number.isFinite(parsedValue) ? parsedValue : null;
    },

    async getMember(memberId) {
      const url = createUrl(config.membersApiBaseUrl, `/api/Members/${memberId}`, {});
      const response = await request(url);
      const parsed = await readJsonWithSchema(
        response,
        z
          .object({
            value: MemberValueSchema
          })
          .passthrough(),
        url.toString()
      );

      return parsed.value;
    },

    async getQuestion(questionId) {
      const url = createUrl(
        config.questionsApiBaseUrl,
        `/api/writtenquestions/questions/${questionId}`,
        {
          expandMember: "true"
        }
      );
      const response = await request(url);
      const parsed = await readJsonWithSchema(
        response,
        z
          .object({
            value: QuestionValueSchema
          })
          .passthrough(),
        url.toString()
      );

      return parsed.value;
    },

    async searchBills({ searchTerm, skip, take }) {
      const url = createUrl(config.billsApiBaseUrl, "/api/v1/Bills", {
        SearchTerm: searchTerm,
        Skip: skip,
        Take: take
      });
      const response = await request(url);
      return readJsonWithSchema(response, BillsSearchResponseSchema, url.toString());
    },

    async searchDivisions({ searchTerm, skip, take }) {
      const url = createUrl(config.commonsVotesApiBaseUrl, "/data/divisions.json/search", {
        "queryParameters.searchTerm": searchTerm,
        "queryParameters.skip": skip,
        "queryParameters.take": take
      });
      const response = await request(url);
      return readJsonWithSchema(response, DivisionSearchResponseSchema, url.toString());
    },

    async searchMembers({ name, skip, take }) {
      const url = createUrl(config.membersApiBaseUrl, "/api/Members/Search", {
        IsCurrentMember: "true",
        Name: name,
        skip,
        take
      });
      const response = await request(url);
      return readJsonWithSchema(response, MemberSearchResponseSchema, url.toString());
    },

    async searchQuestions({ searchTerm, skip, take }) {
      const url = createUrl(config.questionsApiBaseUrl, "/api/writtenquestions/questions", {
        expandMember: "true",
        searchTerm,
        skip,
        take
      });
      const response = await request(url);
      return readJsonWithSchema(response, QuestionsSearchResponseSchema, url.toString());
    }
  };
};
