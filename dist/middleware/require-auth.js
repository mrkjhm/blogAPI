"use strict";
// import { NextFunction, Request, Response } from "express";
// import jwt from "jsonwebtoken";
// import { ENV } from "../config/env";
// import User from "../models/user-model";
// export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const token = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
//     if (!token) {
//       res.status(401).json({ message: "No token" });
//       return;
//     }
//     const payload = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as { sub: string; tv: number };
//     const u = await User.findById(payload.sub).select("+tokenVersion");
//     if (!u || u.tokenVersion !== payload.tv) {
//       res.status(401).json({ message: "Session expired" });
//       return;
//     }
//     req.user = { id: u.id, email: u.email, isAdmin: u.isAdmin };
//     next();
//   } catch (e: any) {
//     const msg = e.name === "TokenExpiredError" ? "Access token expired" : "Unauthorized";
//     res.status(401).json({ message: msg });
//   }
// };
