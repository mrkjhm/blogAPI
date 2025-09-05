"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.adminUpdateUsername = exports.changeEmail = exports.changePassword = exports.updateAvatar = exports.deleteUser = exports.getUserByEmail = exports.getUserById = exports.getAllUser = exports.updateUsername = exports.getProfile = exports.registerUser = exports.loginUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const sharp_1 = __importDefault(require("sharp"));
const cloudinary_1 = require("../config/cloudinary");
const env_1 = require("../config/env");
const user_model_1 = __importDefault(require("../models/user-model"));
const token_1 = require("../utils/token");
const ACCESS_TOKEN_SECRET = env_1.ENV.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = env_1.ENV.REFRESH_TOKEN_SECRET;
function uploadBufferToCloudinary(buffer, opts) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.cloudinary.uploader.upload_stream(opts, (err, result) => err ? reject(err) : resolve(result));
        stream.end(buffer);
    });
}
// LOGIN (USER AND ADMIN) - DONE
const loginUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const email = ((_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
        const password = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.password) !== null && _d !== void 0 ? _d : "";
        if (!email || !password) {
            res.status(400).json({
                message: "email and password are required",
            });
            return;
        }
        // need +password (for compare) and +tokenVersion (to embed tv in JWT)
        const user = yield user_model_1.default.findOne({ email }).select("+password +tokenVersion");
        if (!user) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        // use the schema method instead of raw bcrypt
        const ok = yield user.comparePassword(password);
        if (!ok) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        // non-blocking metadata update
        user.lastLogin = new Date();
        yield user.save({ validateBeforeSave: false });
        const access = (0, token_1.createAccessToken)({
            _id: user._id,
            tokenVersion: user.tokenVersion,
            isAdmin: user.isAdmin,
        });
        const refreshToken = (0, token_1.createRefreshToken)({
            _id: user._id,
            tokenVersion: user.tokenVersion,
        });
        // Optionally also return access in body (useful for Postman / mobile)
        const safe = user.toJSON(); // strips password, avatarPublicId, etc (per schema transform)
        res.status(200).json({
            message: "Login successful",
            user: safe,
            accessToken: access,
            refreshToken: refreshToken,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.loginUser = loginUser;
// REGISTER (USER AND ADMIN) - DONE
const registerUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const name = ((_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "").trim();
        const email = ((_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.email) !== null && _d !== void 0 ? _d : "").trim().toLowerCase();
        const password = (_f = (_e = req.body) === null || _e === void 0 ? void 0 : _e.password) !== null && _f !== void 0 ? _f : "";
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
        if (yield user_model_1.default.exists({ email })) {
            res.status(409).json({ message: "Email already in use" });
            return;
        }
        // ✅ Avatar is REQUIRED
        if (!req.file || !req.file.buffer || req.file.size === 0) {
            res.status(400).json({ message: "Avatar is required" });
            return;
        }
        // Pre-generate _id so we can use it for deterministic Cloudinary public_id
        const userId = new mongoose_1.default.Types.ObjectId();
        // Process + upload avatar
        const optimized = yield (0, sharp_1.default)(req.file.buffer)
            .resize(256, 256, { fit: "cover" })
            .webp({ quality: 85 })
            .toBuffer();
        const folder = "avatars";
        const publicId = `user_${userId}`;
        const uploadResult = yield new Promise((resolve, reject) => {
            const s = cloudinary_1.cloudinary.uploader.upload_stream({
                folder,
                public_id: publicId,
                unique_filename: false,
                overwrite: true,
                invalidate: true,
                resource_type: "image",
            }, (err, result) => (err ? reject(err) : resolve(result)));
            s.on("error", reject);
            s.end(optimized);
        });
        const avatarUrl = uploadResult.secure_url; // versioned URL
        const avatarPublicId = `${folder}/${publicId}`; // "avatars/user_<id>"
        // Create user (pre-save hook should hash password)
        try {
            const user = yield user_model_1.default.create({
                _id: userId,
                name,
                email,
                password, // hashed by pre-save hook
                isAdmin: false, // never accept from client
                avatarUrl,
                avatarPublicId,
            });
            res.status(201).json(user.toJSON ? user.toJSON() : user);
        }
        catch (dbErr) {
            // DB failed after upload → cleanup the Cloudinary asset
            cloudinary_1.cloudinary.uploader
                .destroy(avatarPublicId, { resource_type: "image", invalidate: true })
                .catch(() => { });
            throw dbErr;
        }
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.code) === 11000) {
            res.status(409).json({ message: "Email already in use" });
            return;
        }
        if ((err === null || err === void 0 ? void 0 : err.name) === "ValidationError") {
            res.status(400).json({ message: err.message });
            return;
        }
        if ((err === null || err === void 0 ? void 0 : err.code) === "LIMIT_FILE_SIZE") {
            res.status(413).json({ message: "Avatar file too large" });
            return;
        }
        next(err);
    }
});
exports.registerUser = registerUser;
// GET USER PROFILE
const getProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id; // from token
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        if (!mongoose_1.default.isValidObjectId(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = yield user_model_1.default.findById(userId).select("-password");
        if (!user)
            return res.status(404).json({ message: "User not found" });
        res.status(200).json({ user });
    }
    catch (error) {
        next(error);
    }
});
exports.getProfile = getProfile;
// UPDATE NAME (USER AND ADMIN) - DONE
const updateUsername = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }
        const name = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.trim();
        if (!name) {
            res.status(400).json({ message: "name is required" });
            return;
        }
        const user = yield user_model_1.default.findById(id).select("name");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (name === user.name) {
            res.status(200).json({ message: "No changes", user: user.toJSON() });
            return;
        }
        user.name = name;
        yield user.save();
        res
            .status(200)
            .json({ message: "Name updated successfully", user: user.toJSON() });
    }
    catch (error) {
        next(error);
    }
});
exports.updateUsername = updateUsername;
// GET ALL USERS - DONE
const getAllUser = (_req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield user_model_1.default.find({}).select("-password");
        res.status(200).json(users);
    }
    catch (error) {
        next(error);
    }
});
exports.getAllUser = getAllUser;
// GET USER BY ID - DONE
const getUserById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }
        const user = yield user_model_1.default.findById(id).select("-password");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json(user); // password (hashed) + avatarPublicId will be present
    }
    catch (e) {
        next(e);
    }
});
exports.getUserById = getUserById;
// GET USER BY EMAIL (ADMIN) - DONE
const getUserByEmail = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.params;
        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }
        const user = yield user_model_1.default.findOne({ email }).select("-password");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json(user);
    }
    catch (error) {
        next(error);
    }
});
exports.getUserByEmail = getUserByEmail;
// DELETE USER (ADMIN) - DONE
const deleteUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }
        const user = yield user_model_1.default.findById(id).select("+avatarPublicId");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const publicId = (_a = user.avatarPublicId) !== null && _a !== void 0 ? _a : `avatars/user_${id}`;
        try {
            const result = yield cloudinary_1.cloudinary.uploader.destroy(publicId, {
                resource_type: "image",
                invalidate: true,
                type: "upload"
            });
            result.result;
        }
        catch (error) {
            next(error);
        }
        yield user.deleteOne();
        res.status(200).json({ message: "User deleted successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteUser = deleteUser;
// UPDATE AVATER (USER AND ADMIN) - DONE
const updateAvatar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }
        if (!req.file || !req.file.buffer || req.file.size === 0) {
            res.status(400).json({
                message: "No avatar uploaded or file is empty",
            });
            return;
        }
        const user = yield user_model_1.default.findById(id).select("avatarUrl avatarPublicId");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const oldPublicId = user.avatarPublicId || null;
        const optimized = yield (0, sharp_1.default)(req.file.buffer)
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
        const uploadResult = yield new Promise((resolve, reject) => {
            const s = cloudinary_1.cloudinary.uploader.upload_stream({
                folder,
                public_id: newPublicId,
                overwrite: true,
                invalidate: true,
                unique_filename: false,
                resource_type: "image",
            }, (err, result) => (err ? reject(err) : resolve(result)));
            s.on("error", reject);
            s.end(optimized);
        });
        if (!(uploadResult === null || uploadResult === void 0 ? void 0 : uploadResult.public_id) || !(uploadResult === null || uploadResult === void 0 ? void 0 : uploadResult.secure_url)) {
            res.status(500).json({ message: "Cloudinary upload returned no result" });
            return;
        }
        user.avatarUrl = uploadResult.secure_url;
        user.avatarPublicId = `${folder}/${newPublicId}`;
        yield user.save();
        if (oldPublicId && oldPublicId !== `${folder}/${newPublicId}`) {
            cloudinary_1.cloudinary.uploader
                .destroy(oldPublicId, { resource_type: "image", invalidate: true })
                .catch((e) => console.warn("Old avatar cleanup failed:", (e === null || e === void 0 ? void 0 : e.message) || e));
        }
        res.json({ message: "Avatar updated", user: user.toJSON() });
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.code) === "LIMIT_FILE_SIZE") {
            res.status(413).json({ message: "Avatar file too large" });
            return;
        }
        console.error("Avatar update error:", err);
        res
            .status(500)
            .json({
            message: "Avatar update failed",
            error: (err === null || err === void 0 ? void 0 : err.message) || String(err),
        });
    }
});
exports.updateAvatar = updateAvatar;
const changePassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid user ID" });
            return;
        }
        if (!currentPassword || !newPassword) {
            res
                .status(400)
                .json({ message: "Current password and new password are required" });
            return;
        }
        if (confirmNewPassword !== undefined &&
            newPassword !== confirmNewPassword) {
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
        const user = yield user_model_1.default.findById(id).select("+password +tokenVersion isAdmin");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        // IMPORTANT: use the schema method (no .lean())
        const ok = yield user.comparePassword(currentPassword);
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
        user.password = newPassword;
        user.passwordUpdatedAt = new Date();
        user.tokenVersion = ((_a = user.tokenVersion) !== null && _a !== void 0 ? _a : 0) + 1; // 🔐 revoke old tokens
        yield user.save();
        const accessToken = (0, token_1.createAccessToken)({
            _id: user._id,
            tokenVersion: user.tokenVersion,
            isAdmin: user.isAdmin,
        });
        const refreshToken = (0, token_1.createRefreshToken)({
            _id: user._id,
            tokenVersion: user.tokenVersion,
        });
        res.status(200).json({
            message: "Password changed successfully",
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.changePassword = changePassword;
const changeEmail = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        if (!mongoose_1.default.isValidObjectId(id))
            return res.status(400).json({ message: "Invalid user ID" });
        if (!password || !newEmail)
            return res
                .status(400)
                .json({ message: "Password and new Email are required" });
        const email = newEmail.trim().toLowerCase();
        const exists = yield user_model_1.default.exists({ email, _id: { $ne: id } });
        if (exists)
            return res.status(409).json({ message: "Email already in use" });
        const user = yield user_model_1.default.findById(id).select("+password +tokenVersion email");
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const ok = yield user.comparePassword(password);
        if (!ok)
            return res.status(401).json({ message: "Password is incorrect" });
        user.email = email;
        user.emailVerified = false;
        user.tokenVersion = ((_a = user.tokenVersion) !== null && _a !== void 0 ? _a : 0) + 1; // rotate sessions on email change
        yield user.save();
        const accessToken = (0, token_1.createAccessToken)({
            _id: user._id,
            tokenVersion: user.tokenVersion,
            isAdmin: user.isAdmin,
        });
        const refreshToken = (0, token_1.createRefreshToken)({
            _id: user._id,
            tokenVersion: user.tokenVersion,
        });
        res.status(200).json({
            message: "Email changed successfully",
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.changeEmail = changeEmail;
const adminUpdateUsername = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { id } = req.params;
    const name = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.trim();
    const reason = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.reason) === null || _d === void 0 ? void 0 : _d.trim();
    if (!name)
        return res.status(400).json({ message: "name is required" });
    const user = yield user_model_1.default.findById(id).select("name");
    if (!user)
        return res.status(404).json({ message: "User not found" });
    if (name === user.name)
        return res.status(200).json({ message: "No changes", user: user.toJSON() });
    const oldName = user.name;
    user.name = name;
    yield user.save();
    // minimal audit (you can store in a collection)
    console.log("ADMIN_RENAME", {
        actorId: req.user.id,
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
});
exports.adminUpdateUsername = adminUpdateUsername;
const refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ message: "Missing refresh token" });
    }
    try {
        // 1. Decode and verify refresh token
        const payload = jsonwebtoken_1.default.verify(refreshToken, REFRESH_TOKEN_SECRET);
        // 2. Lookup user and validate tokenVersion
        const user = yield user_model_1.default.findById(payload.sub).select("+tokenVersion");
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        if (user.tokenVersion !== payload.tv) {
            return res.status(401).json({ message: "Token has been revoked" });
        }
        // 3. Generate new access token (15m)
        const newAccessToken = jsonwebtoken_1.default.sign({
            sub: user.id,
            tv: user.tokenVersion,
            isAdmin: user.isAdmin,
        }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
        // 4. Optionally issue new refresh token (7d)
        const newRefreshToken = jsonwebtoken_1.default.sign({
            sub: user.id,
            tv: user.tokenVersion,
        }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
        return res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    }
    catch (err) {
        console.error("Refresh token error:", err);
        return res
            .status(401)
            .json({ message: "Invalid or expired refresh token" });
    }
});
exports.refreshToken = refreshToken;
