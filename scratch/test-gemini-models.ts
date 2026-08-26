import { GoogleGenerativeAI } from "@google/generative-ai";
import envVars from "../src/config/envVars";

async function testModels() {
    const apiKey = envVars.GEMINI_API_KEY || "";
    const genAI = new GoogleGenerativeAI(apiKey);

    const modelsToTest = ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.0-flash-exp"];

    for (const modelName of modelsToTest) {
        try {
            console.log(`\nTesting model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const res = await model.generateContent("Say hi in 1 word.");
            console.log(`>>> SUCCESS for ${modelName}:`, res.response.text());
            process.exit(0);
        } catch (e: any) {
            console.log(`>>> FAILED for ${modelName}:`, e.message);
        }
    }
}

testModels();
