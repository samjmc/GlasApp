import type { Request } from "express";

export type RequestUserId = string | number;

export function getRequestUserId(req: Request): RequestUserId | null {
  const user = req.user;
  const userId =
    user?.id ||
    user?.user?.id ||
    user?.sub ||
    user?.claims?.sub ||
    req.session?.userId;

  if (typeof userId === "string") {
    return userId.length > 0 ? userId : null;
  }

  return typeof userId === "number" ? userId : null;
}
