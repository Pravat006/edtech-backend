import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import modulesRouter from "./modules";
import { convertError, errorMiddleware } from "./middleware/error.middleware";
import { rateLimiter } from "./middleware/rateLimiter";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("dev"));
app.use(helmet());
app.use(rateLimiter);

app.get("/", (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        message: "Welcome to the  Platform API",
        docs: "Endpoints are available under /v1",
    });
    return;
});

app.get("/health", (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        status: "ok",
        message: "Server is running",
        timestamp: new Date().toISOString(),
    });
    return;
});

app.use("/v1", modulesRouter);
app.use(convertError);
app.use(errorMiddleware);

export default app;
