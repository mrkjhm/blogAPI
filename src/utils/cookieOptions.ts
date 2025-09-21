import { CookieOptions } from "express";

export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true, // hindi ma-aaccess ng JS (protection vs XSS)
  secure: process.env.NODE_ENV === "production", // https only sa prod
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // cross-site sa prod
  maxAge: 15 * 60 * 1000, // 15 minutes
};

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
