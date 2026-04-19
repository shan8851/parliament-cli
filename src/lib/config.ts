import { config as loadDotenv } from "dotenv";

export interface ParliamentCliConfig {
  billsApiBaseUrl: string;
  commonsVotesApiBaseUrl: string;
  membersApiBaseUrl: string;
  questionsApiBaseUrl: string;
}

export const loadConfig = (): ParliamentCliConfig => {
  loadDotenv({
    quiet: true
  });

  return {
    billsApiBaseUrl:
      process.env["PARLIAMENT_BILLS_API_BASE_URL"] ?? "https://bills-api.parliament.uk",
    commonsVotesApiBaseUrl:
      process.env["PARLIAMENT_COMMONS_VOTES_API_BASE_URL"] ??
      "https://commonsvotes-api.parliament.uk",
    membersApiBaseUrl:
      process.env["PARLIAMENT_MEMBERS_API_BASE_URL"] ?? "https://members-api.parliament.uk",
    questionsApiBaseUrl:
      process.env["PARLIAMENT_QUESTIONS_API_BASE_URL"] ??
      "https://questions-statements-api.parliament.uk"
  };
};
