import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import { Application } from 'express';

const logsDir = path.join(process.cwd(), 'logs');

// Ensuring logs directory exists
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Unable to create logs directory, file logging disabled:', error);
    }
}

// Helper to generate a timestamp in the local timezone (Asia/Kolkata)
const localTimestamp = () => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };
    const localDate = new Date(date.toLocaleString('en-US', options));

    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Create daily rotating file transports for error, warn, and info levels
const createTransport = (level: string) =>
    new DailyRotateFile({
        filename: path.join(logsDir, '%DATE%', `${level}.log`),
        datePattern: 'YYYY-MM-DD',
        level,
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
    });

const fileTransports: winston.transport[] = [];
if (fs.existsSync(logsDir)) {
    fileTransports.push(
        createTransport('error'),
        createTransport('warn'),
        createTransport('info'),
    );
}

// Winston logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: localTimestamp }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`;
        }),
    ),
    defaultMeta: { service: 'lms-platform-backend' },
    transports: fileTransports,
});

// Always add a console transport (colorized in development)
logger.add(
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: localTimestamp }),
            winston.format.printf(({ timestamp, level, message }) => {
                return `[${timestamp}] ${level}: ${message}`;
            }),
        ),
    }),
);

// Morgan stream that forwards to Winston
const stream = {
    write: (message: string) => logger.info(message.trim()),
};

// Skip function for production health‑check/static routes
const skip = () => process.env.NODE_ENV !== 'production';

/**
 * Attach Morgan middleware to an Express app.
 * In production we use the standard "combined" format; in development we emit a concise, colour‑rich line.
 */
const httpLogger = (app: Application) => {
    if (process.env.NODE_ENV === 'production') {
        app.use(morgan('combined', { stream, skip }));
    } else {
        app.use(
            morgan((tokens, req, res) => {
                return [
                    `[${localTimestamp()}]`,
                    tokens.method?.(req, res),
                    tokens.url?.(req, res),
                    tokens.status?.(req, res),
                    '- ',
                    tokens['response-time']?.(req, res),
                    'ms',
                ].join(' ');
            }, { stream })
        );
    }
};

// Log cleanup – delete folders older than 30 days
const cleanupOldLogs = () => {
    try {
        const folders = fs.readdirSync(logsDir);
        const now = Date.now();
        folders.forEach((folder) => {
            const folderPath = path.join(logsDir, folder);
            if (fs.lstatSync(folderPath).isDirectory()) {
                const folderDate = new Date(folder);
                if (!isNaN(folderDate.getTime())) {
                    const diffDays = Math.ceil(
                        (now - folderDate.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    if (diffDays > 30) {
                        fs.rmSync(folderPath, { recursive: true, force: true });
                        logger.info(`🧹 Deleted old log folder: ${folder}`);
                    }
                }
            }
        });
    } catch (error) {
        logger.error('Error during log cleanup:', error as any);
    }
};

cleanupOldLogs();
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

export { logger, httpLogger };