import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import modulesRouter from "./modules";
import { convertError, errorMiddleware } from "./middleware/error.middleware";
import { rateLimiter } from "./middleware/rateLimiter";
import { httpLogger } from "./config/logger";

const app = express();
httpLogger(app);


const rawAdminOrigin = (process.env.ADMIN_ORIGIN || "http://localhost:3001").replace(/\/$/, "");
const rawFrontendOrigin = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").replace(/\/$/, "");

const allowedOrigins = [
    rawAdminOrigin,
    rawFrontendOrigin,
    "https://lms-admin-dashboard-zeta.vercel.app",
    "http://localhost:3001",
    "http://localhost:3000",
];

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(null, true);
            }
        },
        credentials: true,
    })
);

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
