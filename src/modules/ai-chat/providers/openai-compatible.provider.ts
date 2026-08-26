import { ChatMessagePayload, GenerateOptions, GenerateResult, IAIProvider } from "./ai-provider.interface";
import { logger } from "@/config/logger";

export interface OpenAICompatibleConfig {
    name: string;
    apiKey: string;
    model: string;
    baseUrl: string;
}

export class OpenAICompatibleProvider implements IAIProvider {
    public readonly name: string;
    public readonly model: string;
    private apiKey: string;
    private baseUrl: string;

    constructor(config: OpenAICompatibleConfig) {
        if (!config.apiKey) {
            throw new Error(`[${config.name}] API key is required`);
        }
        this.name = config.name;
        this.model = config.model;
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
    }

    public async generateResponse(
        messages: ChatMessagePayload[],
        options?: GenerateOptions
    ): Promise<GenerateResult> {
        try {
            const formattedMessages = [];

            if (options?.systemPrompt) {
                formattedMessages.push({
                    role: "system",
                    content: options.systemPrompt,
                });
            }

            for (const msg of messages) {
                formattedMessages.push({
                    role: msg.role,
                    content: msg.content,
                });
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: formattedMessages,
                    temperature: options?.temperature ?? 0.5,
                    max_tokens: options?.maxTokens ?? 800,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data: any = await response.json();
            const choice = data.choices?.[0];
            const content = choice?.message?.content || "";

            return {
                content,
                usage: {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                },
                finishReason: choice?.finish_reason,
                provider: this.name,
                model: this.model,
            };
        } catch (error: any) {
            logger.error(`[${this.name}] Error generating response:`, error);
            throw new Error(`[${this.name}] Failed to generate AI response: ${error?.message || error}`);
        }
    }

    public async generateStreamResponse(
        messages: ChatMessagePayload[],
        options: GenerateOptions | undefined,
        onChunk: (chunk: string) => void
    ): Promise<GenerateResult> {
        try {
            const formattedMessages = [];

            if (options?.systemPrompt) {
                formattedMessages.push({
                    role: "system",
                    content: options.systemPrompt,
                });
            }

            for (const msg of messages) {
                formattedMessages.push({
                    role: msg.role,
                    content: msg.content,
                });
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                signal: options?.abortSignal,
                body: JSON.stringify({
                    model: this.model,
                    messages: formattedMessages,
                    temperature: options?.temperature ?? 0.5,
                    max_tokens: options?.maxTokens ?? 800,
                    stream: true,
                }),
            });

            if (!response.ok || !response.body) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            let fullText = "";
            const reader = (response.body as any).getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                if (options?.abortSignal?.aborted) {
                    logger.info(`[${this.name}] Stream reader canceled by abort signal`);
                    try {
                        await reader.cancel();
                    } catch {}
                    break;
                }
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("data: ")) {
                        const jsonStr = trimmed.replace("data: ", "");
                        if (jsonStr === "[DONE]") break;
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullText += delta;
                                onChunk(delta);
                            }
                        } catch {}
                    }
                }
            }

            return {
                content: fullText,
                provider: this.name,
                model: this.model,
            };
        } catch (error: any) {
            logger.error(`[${this.name}] Error streaming response:`, error);
            throw new Error(`[${this.name}] Failed to stream AI response: ${error?.message || error}`);
        }
    }
}
