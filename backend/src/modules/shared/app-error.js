export class AppError extends Error {
  constructor(statusCode, message, code = "REQUEST_FAILED", details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
