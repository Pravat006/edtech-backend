import { aiChatService } from "../src/modules/ai-chat/ai-chat.service";
import { db } from "../src/config/database";

async function runTest() {
    console.log("=== Testing General AI Doubt Asking (without courseId) ===");

    // Find test user
    const user = await db.user.findFirst({
        where: { email: "testpravat@gmail.com" },
    });

    if (!user) {
        console.error("Test user not found!");
        process.exit(1);
    }

    console.log(`Using test user: ${user.email} (${user.id})`);

    let accumulatedText = "";

    try {
        const metadata = await aiChatService.askDoubtStream(
            {
                userId: user.id,
                // courseId is explicitly omitted/undefined for general doubts!
                message: "Explain what is Dijkstra's algorithm in 2 simple bullet points.",
                queryType: "quick",
            },
            (chunk: string) => {
                accumulatedText += chunk;
                process.stdout.write(chunk);
            }
        );

        console.log("\n\n--- Stream Completed ---");
        console.log("Stream Metadata:", metadata);
        console.log("SUCCESS! General topic doubt streaming without courseId works perfectly!");
    } catch (err: any) {
        console.error("FAILED:", err);
    } finally {
        await db.$disconnect();
    }
}

runTest();
