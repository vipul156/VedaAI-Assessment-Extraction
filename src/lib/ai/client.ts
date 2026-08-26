import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function aiConfigFromEnv(): AiConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;
  if (!apiKey || !baseUrl) return null;
  return {
    apiKey,
    baseUrl,
    model: process.env.AI_MODEL || process.env.AI_VISION_MODEL || "gpt-4o-mini",
  };
}

let overrideModel: BaseChatModel | null = null;

/** Test seam: inject a fake model so integration tests are deterministic. */
export function setModelOverride(m: BaseChatModel | null) {
  overrideModel = m;
}

export function getModel(): BaseChatModel {
  if (overrideModel) return overrideModel;
  const cfg = aiConfigFromEnv();
  if (!cfg) {
    throw new Error("AI is not configured (OPENAI_API_KEY / OPENAI_BASE_URL missing)");
  }
  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    configuration: { baseURL: cfg.baseUrl },
    model: cfg.model,
    timeout: 90_000,
    maxRetries: 2,
    temperature: 0,
  });
}

export function aiEnabled(): boolean {
  return overrideModel !== null || aiConfigFromEnv() !== null;
}
