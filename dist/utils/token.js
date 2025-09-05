"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccessToken = createAccessToken;
exports.createRefreshToken = createRefreshToken;
// src/utils/token.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const toId = (id) => typeof id === "string" ? id : id.toString();
function createAccessToken(user) {
    const payload = {
        sub: toId(user._id),
        tv: user.tokenVersion,
        isAdmin: !!user.isAdmin,
    };
    return jsonwebtoken_1.default.sign(payload, env_1.ENV.ACCESS_TOKEN_SECRET, {
        algorithm: "HS256",
        expiresIn: env_1.ENV.ACCESS_TOKEN_TTL,
    });
}
function createRefreshToken(user) {
    const payload = {
        sub: toId(user._id),
        tv: user.tokenVersion,
    };
    return jsonwebtoken_1.default.sign(payload, env_1.ENV.REFRESH_TOKEN_SECRET, {
        algorithm: "HS256",
        expiresIn: env_1.ENV.REFRESH_TOKEN_TTL,
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
