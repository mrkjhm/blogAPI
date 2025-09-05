// src/lib/authz.ts
import type { Request } from "express";

export function canModify(req: Request, ownerId: unknown) {
  if (req.user?.isAdmin) return true;
  return String(ownerId) === req.user?.id;
}
