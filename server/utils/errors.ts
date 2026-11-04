/**
 * The one error a handler or service throws on purpose. The central error handler
 * (server/middleware/errorHandler.ts) answers it with `status` and `{ success:false, error:{ code, message } }`,
 * so `message` must be fit to show a person. Pass `{ cause }` to keep the underlying error in the log.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}
