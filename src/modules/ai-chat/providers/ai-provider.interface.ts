export interface ChatMessagePayload {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface GenerateOptions {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    abortSignal?: AbortSignal;
}

export interface GenerateResult {
    content: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    finishReason?: string;
    provider: string;
    model: string;
}

export interface IAIProvider {
    readonly name: string;
    readonly model: string;

    generateResponse(
        messages: ChatMessagePayload[],
        options?: GenerateOptions
    ): Promise<GenerateResult>;

    generateStreamResponse?(
        messages: ChatMessagePayload[],
        options: GenerateOptions | undefined,
        onChunk: (chunk: string) => void
    ): Promise<GenerateResult>;
}
