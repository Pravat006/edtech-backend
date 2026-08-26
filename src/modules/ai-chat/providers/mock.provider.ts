import { ChatMessagePayload, GenerateOptions, GenerateResult, IAIProvider } from "./ai-provider.interface";

export class MockAiProvider implements IAIProvider {
    public readonly name = "mock";
    public readonly model = "mock-doubt-solver-v1";

    public async generateResponse(
        messages: ChatMessagePayload[],
        _options?: GenerateOptions
    ): Promise<GenerateResult> {
        const lastMsg = messages[messages.length - 1]?.content || "";

        return {
            content: `[Mock AI Answer] Here is the solution to your doubt: "${lastMsg}". Keep practicing!`,
            usage: {
                inputTokens: 120,
                outputTokens: 45,
                totalTokens: 165,
            },
            finishReason: "stop",
            provider: this.name,
            model: this.model,
        };
    }

    public async generateStreamResponse(
        messages: ChatMessagePayload[],
        _options: GenerateOptions | undefined,
        onChunk: (chunk: string) => void
    ): Promise<GenerateResult> {
        const lastMsg = messages[messages.length - 1]?.content || "";
        const fullContent = `[Mock AI Answer] Here is the solution to your doubt: "${lastMsg}". Keep practicing!`;

        const words = fullContent.split(" ");
        for (const word of words) {
            onChunk(word + " ");
            await new Promise((resolve) => setTimeout(resolve, 30));
        }

        return {
            content: fullContent,
            usage: {
                inputTokens: 120,
                outputTokens: 45,
                totalTokens: 165,
            },
            finishReason: "stop",
            provider: this.name,
            model: this.model,
        };
    }
}
