// src/middlewares/auth-jwt.ts
import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ENV } from "../config/env";
import User from "../models/user-model";

// Single source of truth: read Bearer and verify { sub, tv }
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const payload = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as JwtPayload & {
      sub: string; // user id
      tv: number; // tokenVersion
      isAdmin?: boolean;
    };

    const u = await User.findById(payload.sub).select("+tokenVersion");
    if (!u || u.tokenVersion !== payload.tv) {
      return res.status(401).json({ message: "Session expired" });
    }

    // attach normalized user info
    (req as any).user = {
      id: u.id,
      email: u.email,
      isAdmin: u.isAdmin,
      tv: u.tokenVersion,
    };

    return next();
  } catch (e: any) {
    const msg = e.name === "TokenExpiredError" ? "Access token expired" : "Unauthorized";
    res.status(401).json({ message: msg });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.isAdmin) return next();
  return res.status(403).json({ message: "Forbidden" });
};


// Owner-or-admin guard (useful for PUT /users/:id/...)
export const requireSelfOrAdmin =
  (paramKey: string = "id") =>
    (req: Request, res: Response, next: NextFunction) => {
      const me = req.user;
      const targetId = req.params[paramKey];
      if (!me) return res.status(401).json({ message: "Unauthorized" });
      if (me.isAdmin || me.id === targetId) return next();
      return res.status(403).json({ message: "Forbidden: only owner or admin" });
    };
