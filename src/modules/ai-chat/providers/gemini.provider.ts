import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessagePayload, GenerateOptions, GenerateResult, IAIProvider } from "./ai-provider.interface";
import { logger } from "@/config/logger";

export class GeminiProvider implements IAIProvider {
    public readonly name = "gemini";
    public readonly model: string;
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string, modelName: string = "gemini-3.6-flash") {
        if (!apiKey) {
            throw new Error("[GeminiProvider] API key is required");
        }
        this.model = modelName;
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    public async generateResponse(
        messages: ChatMessagePayload[],
        options?: GenerateOptions
    ): Promise<GenerateResult> {
        try {
            const generativeModel = this.genAI.getGenerativeModel({
                model: this.model,
                systemInstruction: options?.systemPrompt,
                generationConfig: {
                    temperature: options?.temperature ?? 0.5,
                    maxOutputTokens: options?.maxTokens ?? 800,
                },
            });

            const history = messages.slice(0, -1).map((msg) => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            }));

            const lastMessage = messages[messages.length - 1]?.content || "";

            const chat = generativeModel.startChat({
                history,
            });

            const result = await chat.sendMessage(lastMessage);
            const responseText = result.response.text();
            const usageMetadata = result.response.usageMetadata;

            return {
                content: responseText,
                usage: {
                    inputTokens: usageMetadata?.promptTokenCount || 0,
                    outputTokens: usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: usageMetadata?.totalTokenCount || 0,
                },
                provider: this.name,
                model: this.model,
            };
        } catch (error: any) {
            logger.error("[GeminiProvider] Error generating response:", error);
            throw new Error(`[GeminiProvider] Failed to generate AI response: ${error?.message || error}`);
        }
    }

    public async generateStreamResponse(
        messages: ChatMessagePayload[],
        options: GenerateOptions | undefined,
        onChunk: (chunk: string) => void
    ): Promise<GenerateResult> {
        try {
            const generativeModel = this.genAI.getGenerativeModel({
                model: this.model,
                systemInstruction: options?.systemPrompt,
                generationConfig: {
                    temperature: options?.temperature ?? 0.5,
                    maxOutputTokens: options?.maxTokens ?? 800,
                },
            });

            const history = messages.slice(0, -1).map((msg) => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            }));

            const lastMessage = messages[messages.length - 1]?.content || "";

            const chat = generativeModel.startChat({
                history,
            });

            const streamingResult = await chat.sendMessageStream(lastMessage);
            let fullText = "";

            for await (const chunk of streamingResult.stream) {
                if (options?.abortSignal?.aborted) {
                    logger.info("[GeminiProvider] Stream canceled by abort signal");
                    break;
                }
                const chunkText = chunk.text();
                fullText += chunkText;
                onChunk(chunkText);
            }

            const response = await streamingResult.response;
            const usageMetadata = response.usageMetadata;

            return {
                content: fullText,
                usage: {
                    inputTokens: usageMetadata?.promptTokenCount || 0,
                    outputTokens: usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: usageMetadata?.totalTokenCount || 0,
                },
                provider: this.name,
                model: this.model,
            };
        } catch (error: any) {
            logger.error("[GeminiProvider] Error streaming response:", error);
            throw new Error(`[GeminiProvider] Failed to stream AI response: ${error?.message || error}`);
        }
    }
}
