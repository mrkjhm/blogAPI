import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import sharp from "sharp";

import { cloudinary } from "../config/cloudinary";
import { ENV } from "../config/env";
import User from "../models/user-model";
import { createAccessToken, createRefreshToken } from "../utils/token";

const ACCESS_TOKEN_SECRET = ENV.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = ENV.REFRESH_TOKEN_SECRET;

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type ChangePasswordBody = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
};

type ChangeEmailBody = {
  password: string;
  newEmail: string;
};

function uploadBufferToCloudinary(buffer: Buffer, opts: any) {
  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) =>
      err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

// LOGIN (USER AND ADMIN) - DONE
export const loginUser = async (
  req: Request<unknown, unknown, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const password = req.body?.password ?? "";

    if (!email || !password) {
      res.status(400).json({
        message: "email and password are required",
      });
      return;
    }

    // need +password (for compare) and +tokenVersion (to embed tv in JWT)
    const user = await User.findOne({ email }).select(
      "+password +tokenVersion"
    );
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // use the schema method instead of raw bcrypt
    const ok = await (user as any).comparePassword(password);
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // non-blocking metadata update
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const access = createAccessToken({
      _id: user._id as string | mongoose.Types.ObjectId,
      tokenVersion: (user as any).tokenVersion,
      isAdmin: user.isAdmin,
    });
    const refreshToken = createRefreshToken({
      _id: user._id as string | mongoose.Types.ObjectId,
      tokenVersion: (user as any).tokenVersion,
    });

    // Optionally also return access in body (useful for Postman / mobile)
    const safe = user.toJSON(); // strips password, avatarPublicId, etc (per schema transform)
    res.status(200).json({
      message: "Login successful",
      user: safe,
      accessToken: access,
      refreshToken: refreshToken,
    });
  } catch (err) {
    next(err);
  }
};
// REGISTER (USER AND ADMIN) - DONE
export const registerUser = async (
  req: Request<unknown, unknown, RegisterBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const name = (req.body?.name ?? "").trim();
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const password = req.body?.password ?? "";

    if (!name || !email || !password) {
      res
        .status(400)
        .json({ message: "name, email and password are required" });
      return;
    }
    if (password.length < 8) {
      res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
      return;
    }
    if (await User.exists({ email })) {
      res.status(409).json({ message: "Email already in use" });
      return;
    }

    // ✅ Avatar is REQUIRED
    if (!req.file || !req.file.buffer || req.file.size === 0) {
      res.status(400).json({ message: "Avatar is required" });
      return;
    }

    // Pre-generate _id so we can use it for deterministic Cloudinary public_id
    const userId = new mongoose.Types.ObjectId();

    // Process + upload avatar
    const optimized = await sharp(req.file.buffer)
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    const folder = "avatars";
    const publicId = `user_${userId}`;

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const s = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          unique_filename: false,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      s.on("error", reject);
      s.end(optimized);
    });

    const avatarUrl = uploadResult.secure_url; // versioned URL
    const avatarPublicId = `${folder}/${publicId}`; // "avatars/user_<id>"

    // Create user (pre-save hook should hash password)
    try {
      const user = await User.create({
        _id: userId,
        name,
        email,
        password, // hashed by pre-save hook
        isAdmin: false, // never accept from client
        avatarUrl,
        avatarPublicId,
      });

      res.status(201).json(user.toJSON ? user.toJSON() : user);
    } catch (dbErr) {
      // DB failed after upload → cleanup the Cloudinary asset
      cloudinary.uploader
        .destroy(avatarPublicId, { resource_type: "image", invalidate: true })
        .catch(() => { });
      throw dbErr;
    }
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ message: "Email already in use" });
      return;
    }
    if (err?.name === "ValidationError") {
      res.status(400).json({ message: err.message });
      return;
    }
    if (err?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "Avatar file too large" });
      return;
    }
    next(err);
  }
};

// GET USER PROFILE
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id; // from token
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// UPDATE NAME (USER AND ADMIN) - DONE
export const updateUsername = async (
  req: Request<{ id: string }, unknown, { name?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // ✅ must be the owner
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (req.user.id !== id) {
      res
        .status(403)
        .json({ message: "Forbidden: you can only edit your own profile" });
      return;
    }

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const name = req.body?.name?.trim();
    if (!name) {
      res.status(400).json({ message: "name is required" });
      return;
    }

    const user = await User.findById(id).select("name");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (name === user.name) {
      res.status(200).json({ message: "No changes", user: user.toJSON() });
      return;
    }

    user.name = name;
    await user.save();

    res
      .status(200)
      .json({ message: "Name updated successfully", user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

// GET ALL USERS - DONE
export const getAllUser = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await User.find({}).select("-password");
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};
// GET USER BY ID - DONE
export const getUserById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user); // password (hashed) + avatarPublicId will be present
  } catch (e) {
    next(e);
  }
};
// GET USER BY EMAIL (ADMIN) - DONE
export const getUserByEmail = async (
  req: Request<{ email: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.params;
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email }).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};
// DELETE USER (ADMIN) - DONE
export const deleteUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const user = await User.findById(id).select("+avatarPublicId");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const publicId = user.avatarPublicId ?? `avatars/user_${id}`;

    try {

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
        type: "upload"
      });

      result.result;

    } catch (error) {
      next(error)
    }


    await user.deleteOne();

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// UPDATE AVATER (USER AND ADMIN) - DONE
export const updateAvatar = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (req.user.id !== id) {
      res
        .status(403)
        .json({ message: "Forbidden: you can only update your own avatar" });
      return;
    }

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    if (!req.file || !req.file.buffer || req.file.size === 0) {
      res.status(400).json({
        message: "No avatar uploaded or file is empty",
      });
      return;
    }

    const user = await User.findById(id).select("avatarUrl avatarPublicId");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const oldPublicId = user.avatarPublicId || null;

    const optimized = await sharp(req.file.buffer)
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    if (!optimized || optimized.length === 0) {
      res.status(400).json({
        message: "Optimized image is empty",
      });
      return;
    }

    const folder = "avatars";
    const newPublicId = `user_${user._id}`;

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const s = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: newPublicId,
          overwrite: true,
          invalidate: true,
          unique_filename: false,
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      s.on("error", reject);
      s.end(optimized);
    });

    if (!uploadResult?.public_id || !uploadResult?.secure_url) {
      res.status(500).json({ message: "Cloudinary upload returned no result" });
      return;
    }

    user.avatarUrl = uploadResult.secure_url;
    user.avatarPublicId = `${folder}/${newPublicId}`;
    await user.save();

    if (oldPublicId && oldPublicId !== `${folder}/${newPublicId}`) {
      cloudinary.uploader
        .destroy(oldPublicId, { resource_type: "image", invalidate: true })
        .catch((e) =>
          console.warn("Old avatar cleanup failed:", e?.message || e)
        );
    }

    res.json({ message: "Avatar updated", user: user.toJSON() });
  } catch (err: any) {
    if (err?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "Avatar file too large" });
      return;
    }
    console.error("Avatar update error:", err);
    res
      .status(500)
      .json({
        message: "Avatar update failed",
        error: err?.message || String(err),
      });
  }
};

export const changePassword = async (
  req: Request<{ id: string }, unknown, ChangePasswordBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (req.user.id !== id) {
      res
        .status(403)
        .json({ message: "Forbidden: you can only change your own password" });
      return;
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    if (!currentPassword || !newPassword) {
      res
        .status(400)
        .json({ message: "Current password and new password are required" });
      return;
    }

    if (
      confirmNewPassword !== undefined &&
      newPassword !== confirmNewPassword
    ) {
      res.status(400).json({ message: "New passwords do not match" });
      return;
    }

    // basic policy – tweak as needed
    if (newPassword.length < 8) {
      res
        .status(400)
        .json({ message: "New password must be at least 8 characters" });
      return;
    }

    const user = await User.findById(id).select(
      "+password +tokenVersion isAdmin"
    );
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // IMPORTANT: use the schema method (no .lean())
    const ok = await (user as any).comparePassword(currentPassword);
    if (!ok) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    if (currentPassword === newPassword) {
      res
        .status(400)
        .json({
          message: "New password must be different from current password",
        });
      return;
    }

    (user as any).password = newPassword;
    (user as any).passwordUpdatedAt = new Date();
    (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1; // 🔐 revoke old tokens
    await user.save();

    const accessToken = createAccessToken({
      _id: user._id as string | mongoose.Types.ObjectId,
      tokenVersion: (user as any).tokenVersion,
      isAdmin: user.isAdmin,
    });
    const refreshToken = createRefreshToken({
      _id: user._id as string | mongoose.Types.ObjectId,
      tokenVersion: (user as any).tokenVersion,
    });

    res.status(200).json({
      message: "Password changed successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const changeEmail = async (
  req: Request<{ id: string }, unknown, ChangeEmailBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (req.user.id !== id) {
      res
        .status(403)
        .json({ message: "Forbidden: you can only change your own email" });
      return;
    }
    const { password, newEmail } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid user ID" });
    if (!password || !newEmail)
      return res
        .status(400)
        .json({ message: "Password and new Email are required" });

    const email = newEmail.trim().toLowerCase();
    const exists = await User.exists({ email, _id: { $ne: id } });
    if (exists)
      return res.status(409).json({ message: "Email already in use" });

    const user = await User.findById(id).select(
      "+password +tokenVersion email"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await (user as any).comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Password is incorrect" });

    user.email = email;
    (user as any).emailVerified = false;
    (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1; // rotate sessions on email change
    await user.save();

    const accessToken = createAccessToken({
      _id: user._id as string | mongoose.Types.ObjectId,
      tokenVersion: (user as any).tokenVersion,
      isAdmin: user.isAdmin,
    });
    const refreshToken = createRefreshToken({
      _id: user._id as string | mongoose.Types.ObjectId,
      tokenVersion: (user as any).tokenVersion,
    });

    res.status(200).json({
      message: "Email changed successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateUsername = async (
  req: Request<{ id: string }, unknown, { name: string; reason?: string }>,
  res: Response
) => {
  const { id } = req.params;
  const name = req.body?.name?.trim();
  const reason = req.body?.reason?.trim();

  if (!name) return res.status(400).json({ message: "name is required" });

  const user = await User.findById(id).select("name");
  if (!user) return res.status(404).json({ message: "User not found" });

  if (name === user.name)
    return res.status(200).json({ message: "No changes", user: user.toJSON() });

  const oldName = user.name;
  user.name = name;
  await user.save();

  // minimal audit (you can store in a collection)
  console.log("ADMIN_RENAME", {
    actorId: req.user!.id,
    targetId: id,
    from: oldName,
    to: name,
    reason: reason || "(none)",
    ip: req.ip,
    ua: req.get("user-agent"),
    at: new Date().toISOString(),
  });

  res
    .status(200)
    .json({ message: "Name updated by admin", user: user.toJSON() });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Missing refresh token" });
  }

  try {
    // 1. Decode and verify refresh token
    const payload = jwt.verify(
      refreshToken,
      REFRESH_TOKEN_SECRET
    ) as jwt.JwtPayload & {
      sub: string; // user ID
      tv: number; // tokenVersion
    };

    // 2. Lookup user and validate tokenVersion
    const user = await User.findById(payload.sub).select("+tokenVersion");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.tokenVersion !== payload.tv) {
      return res.status(401).json({ message: "Token has been revoked" });
    }

    // 3. Generate new access token (15m)
    const newAccessToken = jwt.sign(
      {
        sub: user.id,
        tv: user.tokenVersion,
        isAdmin: user.isAdmin,
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    // 4. Optionally issue new refresh token (7d)
    const newRefreshToken = jwt.sign(
      {
        sub: user.id,
        tv: user.tokenVersion,
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res
      .status(401)
      .json({ message: "Invalid or expired refresh token" });
  }
};
