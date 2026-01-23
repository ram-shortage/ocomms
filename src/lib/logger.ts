import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),

  // Use pino-pretty in development for readability
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Production: JSON format
  formatters: {
    level: (label) => ({ level: label }),
  },

  // Redact sensitive data
  redact: {
    paths: ["password", "token", "secret", "authorization", "cookie"],
    censor: "[REDACTED]",
  },

  // In production, don't serialize error stacks
  ...(isDev
    ? {}
    : {
        serializers: {
          err: (err) => ({
            type: err.constructor.name,
            message: err.message,
            // No stack in production
          }),
        },
      }),
});

// Create child loggers for different modules
export const authLogger = logger.child({ module: "auth" });
export const socketLogger = logger.child({ module: "socket" });
export const queueLogger = logger.child({ module: "queue" });
export const apiLogger = logger.child({ module: "api" });
