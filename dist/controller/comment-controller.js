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
exports.getThread = exports.softDeleteComment = exports.updateComment = exports.getCommentsTree = exports.getReplies = exports.getRootComments = exports.addReply = exports.addComment = void 0;
exports.toDTO = toDTO;
exports.buildTreeDTO = buildTreeDTO;
const mongoose_1 = require("mongoose");
const authz_1 = require("../lib/authz");
const comment_model_1 = __importDefault(require("../models/comment-model"));
const post_model_1 = __importDefault(require("../models/post-model"));
// comment-controller.ts (or a shared dto file)
function toDTO(r) {
    var _a, _b;
    const rawUser = (r.user && typeof r.user === "object" ? r.user : null) ||
        (r.userId && typeof r.userId === "object" ? r.userId : null);
    const userId = (_a = rawUser === null || rawUser === void 0 ? void 0 : rawUser._id) !== null && _a !== void 0 ? _a : r.userId;
    const name = typeof (rawUser === null || rawUser === void 0 ? void 0 : rawUser.name) === "string" && rawUser.name.trim()
        ? rawUser.name.trim()
        : "Unknown";
    const avatarUrl = typeof (rawUser === null || rawUser === void 0 ? void 0 : rawUser.avatarUrl) === "string" && rawUser.avatarUrl.trim()
        ? rawUser.avatarUrl
        : undefined;
    const isDeleted = !!r.deleted; // <--- read the flag
    return {
        _id: String(r._id),
        postId: String(r.postId),
        user: { _id: String(userId), name, avatarUrl },
        comment: r.comment,
        parentId: r.parentId ? String(r.parentId) : null,
        rootId: r.rootId ? String(r.rootId) : null,
        depth: typeof r.depth === "number" ? r.depth : 0,
        createdAt: r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : new Date(r.createdAt).toISOString(),
        isEdited: (_b = r.isEdited) !== null && _b !== void 0 ? _b : false,
        editedAt: r.editedAt ? new Date(r.editedAt).toISOString() : undefined,
        isDeleted, // <--- expose for UI logic
    };
}
// Build tree from already-normalized flat rows
function buildTreeDTO(rows) {
    const map = new Map();
    rows.forEach((r) => map.set(r._id, Object.assign(Object.assign({}, r), { replies: [] })));
    const roots = [];
    for (const r of map.values()) {
        if (r.parentId && map.has(r.parentId)) {
            map.get(r.parentId).replies.push(r);
        }
        else {
            roots.push(r);
        }
    }
    // sort newest-first recursively
    const sortDesc = (arr) => {
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        arr.forEach((n) => sortDesc(n.replies));
    };
    sortDesc(roots);
    return roots;
}
function parseLimit(q, fallback = 10, max = 50) {
    const n = Number(q);
    if (!Number.isFinite(n) || n <= 0)
        return fallback;
    return Math.min(n, max);
}
function computeThreadMeta(postId, parentId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!parentId)
            return { parentObjId: null, rootId: null, depth: 0 };
        if (!mongoose_1.Types.ObjectId.isValid(parentId)) {
            throw Object.assign(new Error("Invalid parentId"), { status: 400 });
        }
        const parent = yield comment_model_1.default.findById(parentId)
            .select("postId deleted rootId depth")
            .lean();
        if (!parent || String(parent.postId) !== String(postId)) {
            throw Object.assign(new Error("Invalid parentId for this post"), { status: 400 });
        }
        if (parent.deleted) {
            throw Object.assign(new Error("Cannot reply to a deleted comment"), { status: 400 });
        }
        const rootId = (_a = parent.rootId) !== null && _a !== void 0 ? _a : parent._id;
        const depth = ((_b = parent.depth) !== null && _b !== void 0 ? _b : 0) + 1;
        return { parentObjId: parent._id, rootId, depth };
    });
}
const MAX_DEPTH = 3;
const addComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { postId } = req.params;
        const { comment, parentId } = req.body;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id))
            return res.status(401).json({ message: "Unauthorized" });
        if (!mongoose_1.Types.ObjectId.isValid(postId))
            return res.status(400).json({ message: "Invalid postId" });
        const text = comment === null || comment === void 0 ? void 0 : comment.trim();
        if (!text)
            return res.status(400).json({ message: "Comment is required" });
        const post = yield post_model_1.default.findById(postId).select("_id");
        if (!post)
            return res.status(404).json({ message: "Post not found" });
        const { parentObjId, rootId, depth } = yield computeThreadMeta(postId, parentId);
        // if (depth > MAX_DEPTH) return res.status(400).json({ message: `Max reply depth is ${MAX_DEPTH}` });
        const session = yield comment_model_1.default.startSession();
        session.startTransaction();
        let createdId;
        try {
            const created = yield new comment_model_1.default({
                postId: post._id,
                userId: new mongoose_1.Types.ObjectId(req.user.id),
                comment: text,
                parentId: parentObjId,
                rootId,
                depth,
            }).save({ session });
            createdId = created._id;
            yield post_model_1.default.findByIdAndUpdate(post._id, { $push: { comments: created._id } }, { session });
            yield session.commitTransaction();
            session.endSession();
        }
        catch (err) {
            yield session.abortTransaction();
            session.endSession();
            throw err;
        }
        // fetch populated & return DTO
        const saved = yield comment_model_1.default.findById(createdId)
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt")
            .populate("userId", "name avatarUrl")
            .lean();
        res.status(201).json({
            message: "Comment added",
            comment: saved ? toDTO(saved) : null,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addComment = addComment;
const addReply = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { postId, parentId } = req.params;
        const { comment } = req.body;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (!(comment === null || comment === void 0 ? void 0 : comment.trim())) {
            res.status(400).json({ message: "Comment is required" });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(postId) || !mongoose_1.Types.ObjectId.isValid(parentId)) {
            res.status(400).json({ message: "Invalid ids" });
            return;
        }
        const parent = yield comment_model_1.default.findById(parentId)
            .select("postId deleted rootId depth")
            .lean();
        if (!parent || String(parent.postId) !== String(postId)) {
            res.status(400).json({ message: "Invalid parentId for this post" });
            return;
        }
        if (parent.deleted && !req.user.isAdmin) {
            res.status(400).json({ message: "Cannot reply to a deleted comment" });
            return;
        }
        const rootId = (_b = parent.rootId) !== null && _b !== void 0 ? _b : parent._id;
        const depth = ((_c = parent.depth) !== null && _c !== void 0 ? _c : 0) + 1;
        const reply = yield comment_model_1.default.create({
            postId: new mongoose_1.Types.ObjectId(postId),
            userId: new mongoose_1.Types.ObjectId(req.user.id),
            comment: comment.trim(),
            parentId: new mongoose_1.Types.ObjectId(parentId),
            rootId,
            depth,
        });
        yield post_model_1.default.findByIdAndUpdate(postId, { $push: { comments: reply._id } });
        const populated = yield comment_model_1.default.findById(reply._id)
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt")
            .populate("userId", "name avatarUrl")
            .lean();
        res.status(201).json({
            message: "Reply added",
            comment: populated ? toDTO(populated) : null,
        });
    }
    catch (e) {
        res.status(500).json({ message: "Error adding reply", error: e });
    }
});
exports.addReply = addReply;
// ---------- READ (paginated roots) ----------
const getRootComments = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ message: "Invalid postId" });
            return;
        }
        const limit = parseLimit(req.query.limit, 10, 50);
        const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined;
        const filter = Object.assign({ postId: new mongoose_1.Types.ObjectId(postId), parentId: null }, (cursor ? { createdAt: { $gt: cursor } } : {}));
        const rows = yield comment_model_1.default.find(filter)
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted")
            .populate("userId", "name avatarUrl")
            .sort({ createdAt: 1 })
            .limit(limit + 1)
            .lean();
        const hasNext = rows.length > limit;
        const page = hasNext ? rows.slice(0, limit) : rows;
        const data = page.map(toDTO);
        const nextCursor = hasNext && page.length
            ? new Date(page[page.length - 1].createdAt).toISOString()
            : null;
        res.json({ data, nextCursor });
    }
    catch (err) {
        next(err);
    }
});
exports.getRootComments = getRootComments;
// ---------- READ (paginated replies for one comment) ----------
const getReplies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { commentId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ message: "Invalid commentId" });
            return;
        }
        const limit = parseLimit(req.query.limit, 10, 50);
        const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined;
        const filter = Object.assign({ parentId: new mongoose_1.Types.ObjectId(commentId) }, (cursor ? { createdAt: { $gt: cursor } } : {}));
        const rows = yield comment_model_1.default.find(filter)
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted")
            .populate("userId", "name avatarUrl")
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .lean();
        const hasNext = rows.length > limit;
        const page = hasNext ? rows.slice(0, limit) : rows;
        const data = page.map(toDTO);
        const nextCursor = hasNext && page.length
            ? new Date(page[page.length - 1].createdAt).toISOString()
            : null;
        res.json({ data, nextCursor });
    }
    catch (err) {
        next(err);
    }
});
exports.getReplies = getReplies;
// ---------- READ (full nested tree for a post — use sparingly) ----------
const getCommentsTree = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ message: "Invalid postId" });
            return;
        }
        const rows = yield comment_model_1.default.find({ postId: new mongoose_1.Types.ObjectId(postId) })
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted")
            .populate("userId", "name avatarUrl")
            .sort({ createdAt: 1 })
            .lean();
        const dto = rows.map(toDTO);
        res.json(buildTreeDTO(dto));
    }
    catch (err) {
        next(err);
    }
});
exports.getCommentsTree = getCommentsTree;
const updateComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { commentId } = req.params;
        const { comment } = req.body;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({
                message: "Unauthorized"
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ message: "Invalid commentId" });
            return;
        }
        if (!(comment === null || comment === void 0 ? void 0 : comment.trim())) {
            res.status(400).json({ message: "Comment is required" });
            return;
        }
        const existing = yield comment_model_1.default.findById(commentId).select("_id userId deleted");
        if (!existing) {
            res.status(404).json({ message: "Comment not found" });
            return;
        }
        if (!(0, authz_1.canModify)(req, existing.userId)) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        if (existing.deleted && !req.user.isAdmin) {
            res.status(400).json({ message: "Cannot edit a deleted comment" });
            return;
        }
        const updated = yield comment_model_1.default.findByIdAndUpdate(existing._id, { $set: { comment: comment.trim(), isEdited: true, editedAt: new Date() } }, { new: true })
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt updatedAt")
            .populate("userId", "name avatarUrl")
            .lean();
        res.json({
            message: "Comment updated",
            comment: updated ? toDTO(updated) : null,
        });
    }
    catch (err) {
        res.status(500).json({ message: "Error updating comment", error: err });
    }
});
exports.updateComment = updateComment;
// Soft delete (admin or owner)
// ---------- SOFT DELETE (owner or admin) ----------
const softDeleteComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { commentId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({ message: "Invalid commentId" });
            return;
        }
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        // 1) Load minimal fields for authz
        const base = yield comment_model_1.default.findById(commentId).select("_id userId deleted");
        if (!base) {
            res.status(404).json({ message: "Comment not found" });
            return;
        }
        if (!(0, authz_1.canModify)(req, base.userId)) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        // 2) Guarded update: only if not yet deleted
        const updated = yield comment_model_1.default.findOneAndUpdate({ _id: base._id, deleted: false }, // guard vs race
        {
            $set: {
                deleted: true,
                deletedAt: new Date(),
                deletedBy: new mongoose_1.Types.ObjectId(req.user.id),
                comment: "This comment has been deleted", // <--- standardize
            },
        }, {
            new: true,
            projection: "_id comment deleted deletedAt deletedBy",
            lean: true, // bypasses toJSON transform so meta fields are visible
        });
        if (!updated) {
            // either already deleted, or raced — return current state for consistency
            const already = yield comment_model_1.default.findById(commentId)
                .select("_id comment deleted deletedAt deletedBy")
                .lean();
            res.status(200).json({ message: "Already deleted", comment: already });
            return;
        }
        res.status(200).json({ message: "Comment soft-deleted", comment: updated });
    }
    catch (err) {
        next(err);
    }
});
exports.softDeleteComment = softDeleteComment;
// ---------- READ (one thread for a post) ----------
const getThread = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId, rootId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(postId) || !mongoose_1.Types.ObjectId.isValid(rootId)) {
            res.status(400).json({ message: "Invalid ids" });
            return;
        }
        const rows = yield comment_model_1.default.find({
            postId: new mongoose_1.Types.ObjectId(postId),
            $or: [
                { _id: new mongoose_1.Types.ObjectId(rootId) },
                { rootId: new mongoose_1.Types.ObjectId(rootId) },
            ],
        })
            .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted") // +deleted
            .populate("userId", "name avatarUrl")
            .sort({ createdAt: 1 })
            .lean();
        const dto = rows.map(toDTO);
        res.json(buildTreeDTO(dto));
    }
    catch (err) {
        next(err);
    }
});
exports.getThread = getThread;
