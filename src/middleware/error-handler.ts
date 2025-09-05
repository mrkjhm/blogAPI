import { NextFunction, Request, Response } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  // Handle Multer file-size errors gracefully
  const isFileTooLarge = err?.code === "LIMIT_FILE_SIZE";
  const statusCode = isFileTooLarge ? 413 : err.status || 500;
  const errorMessage = isFileTooLarge
    ? "File too large. Please upload a smaller image."
    : err.message || "Internal Server Error";

  res.status(statusCode).json({
    error: {
      message: errorMessage,
      errorCode: err.code || "SERVER_ERROR",
      details: err.details || null,
    },
  });
}


// type AppError = { status?: number; message?: string; code?: string; details?: unknown };

// export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
//   res.status(err.status ?? 500).json({
//     error: { message: err.message ?? "Internal Server Error", errorCode: err.code ?? "SERVER_ERROR", details: err.details ?? null },
//   });
// }