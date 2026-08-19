import app from "./app";
import { logger } from "./lib/logger";

const PORT = process.env.PORT || 3000;

app.listen(Number(PORT), "0.0.0.0", () => {
    logger.info(`[SERVER] backend is live on http://0.0.0.0:${PORT}`);
});

