"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAvatar = exports.uploadPostImage = void 0;
// middlewares/upload.ts
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
exports.uploadPostImage = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
}).single("imageUrl");
exports.uploadAvatar = (0, multer_1.default)({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
}).single("avatarUrl");
