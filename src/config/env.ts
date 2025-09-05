import dotenv from "dotenv";
import { SignOptions } from "jsonwebtoken";
dotenv.config();

// helper to require envs with nice typing
const required = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set in .env`);
  return v; // string
};

// optional getter with default
const optional = (key: string, def: string) =>
  process.env[key] ?? def;

const toNumber = (key: string) => {
  const n = Number(required(key));
  if (Number.isNaN(n)) throw new Error(`${key} must be a number`);
  return n;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  PORT: toNumber("PORT"),
  MONGODB_URI: required("MONGODB_URI"),
  BCRYPT_SALT_ROUNDS: toNumber("BCRYPT_SALT_ROUNDS"),

  // If comma-separated: "http://localhost:3000,https://example.com"
  CORS_ORIGINS: required("CORS_ORIGINS"),

  // New JWT secrets (separate for access/refresh)
  ACCESS_TOKEN_SECRET: required("ACCESS_TOKEN_SECRET"),
  REFRESH_TOKEN_SECRET: required("REFRESH_TOKEN_SECRET"),

  // TTLs with sane defaults (no need to throw above)
  ACCESS_TOKEN_TTL: (process.env.ACCESS_TOKEN_TTL ?? "1h") as NonNullable<SignOptions["expiresIn"]>,
  REFRESH_TOKEN_TTL: (process.env.REFRESH_TOKEN_TTL ?? "7d") as NonNullable<SignOptions["expiresIn"]>,

  CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),
} as const;
