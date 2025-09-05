// src/utils/token.ts
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { ENV } from "../config/env";

export type AccessPayload = {
  sub: string;   // user id
  tv: number;    // tokenVersion
  isAdmin?: boolean;
};
export type RefreshPayload = AccessPayload;

const toId = (id: string | Types.ObjectId) =>
  typeof id === "string" ? id : id.toString();

export function createAccessToken(user: {
  _id: string | Types.ObjectId;
  tokenVersion: number;
  isAdmin?: boolean;
}): string {
  const payload: AccessPayload = {
    sub: toId(user._id),
    tv: user.tokenVersion,
    isAdmin: !!user.isAdmin,
  };

  return jwt.sign(payload, ENV.ACCESS_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: ENV.ACCESS_TOKEN_TTL,
  });
}

export function createRefreshToken(user: {
  _id: string | Types.ObjectId;
  tokenVersion: number;
}): string {
  const payload: RefreshPayload = {
    sub: toId(user._id),
    tv: user.tokenVersion,
  };

  return jwt.sign(payload, ENV.REFRESH_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: ENV.REFRESH_TOKEN_TTL,
  });
}

/* Optional helpers
export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as AccessPayload;
}
export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, ENV.REFRESH_TOKEN_SECRET) as RefreshPayload;
}
*/
