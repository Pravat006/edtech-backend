import envVars from "@/config/envVars";
import { IAIProvider } from "./ai-provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { OpenAICompatibleProvider } from "./openai-compatible.provider";
import { MockAiProvider } from "./mock.provider";
import { logger } from "@/config/logger";

export function createAIProvider(overrideProvider?: string): IAIProvider {
    const providerType = overrideProvider || envVars.AI_PROVIDER || "mock";

    logger.info(`[AIProviderFactory] Initializing AI Provider strategy: '${providerType}'`);

    switch (providerType.toLowerCase()) {
        case "gemini": {
            if (!envVars.GEMINI_API_KEY) {
                logger.warn("[AIProviderFactory] GEMINI_API_KEY missing. Falling back to MockAiProvider.");
                return new MockAiProvider();
            }
            return new GeminiProvider(envVars.GEMINI_API_KEY, envVars.GEMINI_MODEL);
        }

        case "groq": {
            if (!envVars.GROQ_API_KEY) {
                logger.warn("[AIProviderFactory] GROQ_API_KEY missing. Falling back to MockAiProvider.");
                return new MockAiProvider();
            }
            return new OpenAICompatibleProvider({
                name: "groq",
                apiKey: envVars.GROQ_API_KEY,
                model: envVars.GROQ_MODEL || "llama-3.1-70b-versatile",
                baseUrl: "https://api.groq.com/openai/v1",
            });
        }

        case "openrouter": {
            if (!envVars.OPENROUTER_API_KEY) {
                logger.warn("[AIProviderFactory] OPENROUTER_API_KEY missing. Falling back to MockAiProvider.");
                return new MockAiProvider();
            }
            return new OpenAICompatibleProvider({
                name: "openrouter",
                apiKey: envVars.OPENROUTER_API_KEY,
                model: envVars.OPENROUTER_MODEL || "meta-llama/llama-3.1-70b-instruct",
                baseUrl: "https://openrouter.ai/api/v1",
            });
        }

        case "openai": {
            if (!envVars.OPENAI_API_KEY) {
                logger.warn("[AIProviderFactory] OPENAI_API_KEY missing. Falling back to MockAiProvider.");
                return new MockAiProvider();
            }
            return new OpenAICompatibleProvider({
                name: "openai",
                apiKey: envVars.OPENAI_API_KEY,
                model: envVars.OPENAI_MODEL || "gpt-4o-mini",
                baseUrl: "https://api.openai.com/v1",
            });
        }

        case "mock":
        default:
            return new MockAiProvider();
    }
}
