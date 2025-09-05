// middlewares/upload.ts
import multer from "multer";

const storage = multer.memoryStorage();

export const uploadPostImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("imageUrl");


export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
}).single("avatarUrl");