import envVars from "../src/config/envVars";

async function listGeminiModels() {
    const apiKey = envVars.GEMINI_API_KEY || "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        console.log("Fetching available models from Google API...");
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) {
            console.log("Available Gemini Models:");
            for (const m of data.models) {
                if (m.supportedGenerationMethods?.includes("generateContent")) {
                    console.log(` - ${m.name.replace("models/", "")} (${m.displayName})`);
                }
            }
        } else {
            console.error("Error response from API:", data);
        }
    } catch (err: any) {
        console.error("Failed to list models:", err);
    }
}

listGeminiModels();
