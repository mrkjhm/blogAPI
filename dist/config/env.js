"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// helper to require envs with nice typing
const required = (key) => {
    const v = process.env[key];
    if (!v)
        throw new Error(`${key} is not set in .env`);
    return v; // string
};
// optional getter with default
const optional = (key, def) => { var _a; return (_a = process.env[key]) !== null && _a !== void 0 ? _a : def; };
const toNumber = (key) => {
    const n = Number(required(key));
    if (Number.isNaN(n))
        throw new Error(`${key} must be a number`);
    return n;
};
exports.ENV = {
    NODE_ENV: (_a = process.env.NODE_ENV) !== null && _a !== void 0 ? _a : "development",
    PORT: toNumber("PORT"),
    MONGODB_URI: required("MONGODB_URI"),
    BCRYPT_SALT_ROUNDS: toNumber("BCRYPT_SALT_ROUNDS"),
    // If comma-separated: "http://localhost:3000,https://example.com"
    CORS_ORIGINS: required("CORS_ORIGINS"),
    // New JWT secrets (separate for access/refresh)
    ACCESS_TOKEN_SECRET: required("ACCESS_TOKEN_SECRET"),
    REFRESH_TOKEN_SECRET: required("REFRESH_TOKEN_SECRET"),
    // TTLs with sane defaults (no need to throw above)
    ACCESS_TOKEN_TTL: ((_b = process.env.ACCESS_TOKEN_TTL) !== null && _b !== void 0 ? _b : "1h"),
    REFRESH_TOKEN_TTL: ((_c = process.env.REFRESH_TOKEN_TTL) !== null && _c !== void 0 ? _c : "7d"),
    CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
    CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
    CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),
    // Swagger protection toggles (optional)
    SWAGGER_ENABLED: ((_d = process.env.SWAGGER_ENABLED) !== null && _d !== void 0 ? _d : "false") === "true",
    DOCS_USER: (_e = process.env.DOCS_USER) !== null && _e !== void 0 ? _e : "",
    DOCS_PASS: (_f = process.env.DOCS_PASS) !== null && _f !== void 0 ? _f : "",
};
