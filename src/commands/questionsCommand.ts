import type { Command } from "commander";

import { parseNonNegativeInteger, parsePositiveInteger } from "../lib/commandUtils.js";
import { DEFAULT_PAGE_SIZE } from "../lib/constants.js";
import { toQuestionSummary } from "../lib/normalize.js";
import { runCommand, withGlobalOutputOptions } from "../lib/output.js";
import { parseQueryOrId } from "../lib/resolve.js";

import type { CliDependencies } from "../buildCli.js";
import type { PaginationMeta, QuestionSummary } from "../types.js";

type QuestionsCommandOptions = {
  json?: boolean;
  skip?: number;
  take?: number;
  text?: boolean;
};

interface QuestionByIdData {
  input: {
    queryOrId: string;
  };
  mode: "id";
  question: QuestionSummary & {
    answerText: string | null;
    answeringBodyName: string | null;
    dateAnswered: string | null;
    dateTabled: string | null;
  };
}

interface QuestionsSearchData {
  input: {
    query: string;
    skip: number;
    take: number;
  };
  mode: "search";
  pagination: PaginationMeta;
  results: QuestionSummary[];
}

type QuestionsData = QuestionByIdData | QuestionsSearchData;

export const registerQuestionsCommand = (program: Command, dependencies: CliDependencies): void => {
  program
    .command("questions <queryOrId>")
    .description("Get a written question by id, or search written questions by term.")
    .option("--take <number>", "Results per page for search mode (default 10).", parsePositiveInteger, DEFAULT_PAGE_SIZE)
    .option("--skip <number>", "Rows to skip for search mode (default 0).", parseNonNegativeInteger, 0)
    .option("--json", "Force JSON output")
    .option("--text", "Force text output")
    .addHelpText(
      "after",
      "\nExamples:\n  parliament questions 1899443\n  parliament questions \"NHS waiting times\""
    )
    .action(async (queryOrId: string, options: QuestionsCommandOptions, command: Command) => {
      await runCommand(
        "questions",
        withGlobalOutputOptions(command, options),
        dependencies.runtime,
        async (): Promise<QuestionsData> => {
          const parsed = parseQueryOrId(queryOrId);

          if (parsed.id !== null) {
            const question = await dependencies.client.getQuestion(parsed.id);

            return {
              input: {
                queryOrId
              },
              mode: "id",
              question: {
                ...toQuestionSummary(question),
                answerText: question.answerText ?? null,
                answeringBodyName: question.answeringBodyName ?? null,
                dateAnswered: question.dateAnswered ?? null,
                dateTabled: question.dateTabled ?? null
              }
            };
          }

          const take = options.take ?? DEFAULT_PAGE_SIZE;
          const skip = options.skip ?? 0;
          const result = await dependencies.client.searchQuestions({
            searchTerm: parsed.query,
            skip,
            take
          });
          const summaries = result.results.map((item) => toQuestionSummary(item.value));

          return {
            input: {
              query: parsed.query,
              skip,
              take
            },
            mode: "search",
            pagination: {
              fetchedAll: false,
              itemsPerPage: take,
              returnedCount: summaries.length,
              startIndex: skip,
              totalResults: result.totalResults
            },
            results: summaries
          };
        },
        (data) => {
          if (data.mode === "id") {
            return [
              `Written Question ${data.question.uin} (#${data.question.id})`,
              `House: ${data.question.house}`,
              `Tabled: ${data.question.dateTabled ?? "Unknown"}`,
              `Answered: ${data.question.dateAnswered ?? "Not answered"}`,
              `Department: ${data.question.answeringBodyName ?? "Unknown"}`,
              "",
              data.question.questionText,
              ...(data.question.answerText === null ? [] : ["", data.question.answerText])
            ].join("\n");
          }

          if (data.results.length === 0) {
            return `No written questions found for "${data.input.query}".`;
          }

          return [
            `Written questions for "${data.input.query}" (${data.results.length}/${data.pagination.totalResults})`,
            ...data.results.map((question) => `- ${question.id} (${question.uin}) ${question.questionText}`)
          ].join("\n");
        }
      );
    });
};
