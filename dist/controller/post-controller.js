"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.uploadImage = exports.deletePost = exports.updatePost = exports.getPostBySlug = exports.getPostById = exports.getPosts = exports.createPost = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const slugify_1 = __importDefault(require("slugify"));
const cloudinary_1 = require("../config/cloudinary");
const comment_model_1 = __importDefault(require("../models/comment-model"));
const post_model_1 = __importDefault(require("../models/post-model"));
const upload_image_1 = require("../utils/upload-image");
const createPost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { title, description, content, category } = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
        if (!((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || !mongoose_1.default.isValidObjectId(req.user.id)) {
            res.status(401).json({ message: "Unauthorized user" });
            return;
        }
        if (!(title === null || title === void 0 ? void 0 : title.trim()) || !(description === null || description === void 0 ? void 0 : description.trim()) || !(content === null || content === void 0 ? void 0 : content.trim()) || !(category === null || category === void 0 ? void 0 : category.trim())) {
            res.status(400).json({ message: "All fields are required (including category)" });
            return;
        }
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: "Image file is required" });
            return;
        }
        const { url, publicId } = yield (0, upload_image_1.uploadImage)(file.buffer, file.originalname, { folder: "posts", publicIdBase: title, });
        // ✅ Generate unique slug from title
        const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
        let uniqueSlug = baseSlug;
        let counter = 1;
        // Ensure uniqueness
        while (yield post_model_1.default.exists({ slug: uniqueSlug })) {
            uniqueSlug = `${baseSlug}-${counter++}`;
        }
        const categorySlug = (0, slugify_1.default)(category, { lower: true, strict: true });
        // ✅ Create post with generated slug
        const created = yield post_model_1.default.create({
            author: req.user.id,
            title,
            slug: uniqueSlug, // ✅ added
            imageUrl: url,
            imagePublicId: publicId,
            description,
            content,
            category,
            categorySlug
        });
        res.status(201).json(created);
    }
    catch (error) {
        next(error);
    }
});
exports.createPost = createPost;
// Build a nested tree for one post's comments
function buildTree(rows) {
    const map = new Map();
    const roots = [];
    rows.forEach((r) => map.set(String(r._id), Object.assign(Object.assign({}, r), { replies: [] })));
    rows.forEach((r) => {
        const id = String(r._id);
        const pid = r.parentId ? String(r.parentId) : null;
        if (pid && map.has(pid))
            map.get(pid).replies.push(map.get(id));
        else
            roots.push(map.get(id));
    });
    return roots;
}
const getPosts = (_req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const posts = yield post_model_1.default.find({})
            .sort({ createdAt: -1 })
            .populate("author", "name avatarUrl")
            .lean();
        if (posts.length === 0)
            return res.status(200).json([]);
        const postIds = posts.map((p) => p._id);
        const comments = yield comment_model_1.default.find({ postId: { $in: postIds } })
            .select("-deleted -deletedAt -deletedBy -createdAt -updatedAt -__v")
            .populate("userId", "name email avatarUrl")
            .sort({ createdAt: 1 })
            .lean();
        const byPost = new Map();
        comments.forEach((c) => {
            const key = String(c.postId);
            if (!byPost.has(key))
                byPost.set(key, []);
            byPost.get(key).push(c);
        });
        const result = posts.map((p) => {
            var _a;
            const rows = (_a = byPost.get(String(p._id))) !== null && _a !== void 0 ? _a : [];
            const commentsTree = buildTree(rows);
            return Object.assign(Object.assign({}, p), { commentsTree });
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.getPosts = getPosts;
const getPostById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid post ID" });
            return;
        }
        // 1) Get the post itself (lean for perf)
        const post = yield post_model_1.default.findById(new mongoose_1.Types.ObjectId(id)).lean();
        if (!post) {
            res.status(404).json({ message: "Post not found" });
            return;
        }
        // 2) Get all comments for this post and build a nested tree
        const rows = yield comment_model_1.default.find({ postId: new mongoose_1.Types.ObjectId(id) })
            .populate("userId", "name email avatar")
            .sort({ createdAt: 1 })
            .lean();
        const commentsTree = buildTree(rows);
        // 3) Return post + nested comments (omit flat post.comments if you want)
        res.status(200).json(Object.assign(Object.assign({}, post), { commentsTree }));
    }
    catch (error) {
        next(error);
    }
});
exports.getPostById = getPostById;
// GET /api/posts/slug/:slug
const getPostBySlug = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { slug } = req.params;
        const post = yield post_model_1.default.findOne({ slug })
            .populate("author", "name email avatarUrl") // ✅ this enables full author data
            .lean();
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        const rows = yield comment_model_1.default.find({ postId: post._id })
            .sort({ createdAt: 1 }) // newest first
            .populate("userId", "name email avatar") // (author → userId for comments)
            .lean();
        const commentsTree = buildTree(rows);
        res.status(200).json(Object.assign(Object.assign({}, post), { commentsTree }));
    }
    catch (error) {
        next(error);
    }
});
exports.getPostBySlug = getPostBySlug;
const updatePost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const postId = req.params.id;
        if (!mongoose_1.default.isValidObjectId(postId)) {
            res.status(400).json({ message: "Invalid post ID" });
            return;
        }
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || !mongoose_1.default.isValidObjectId(req.user.id)) {
            res.status(401).json({ message: "Unauthorized user" });
            return;
        }
        // 🔑 fetch the post first so we can check ownership/admin
        const post = yield post_model_1.default.findById(postId);
        if (!post) {
            res.status(404).json({ message: "Post not found" });
            return;
        }
        // ✅ allow only if admin OR owner
        if (!req.user.isAdmin && String(post.author) !== req.user.id) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        const { title, description, content, imageUrl, imagePublicId, category } = (_b = req.body) !== null && _b !== void 0 ? _b : {};
        // set only if provided (avoid overwriting with undefined)
        if (title === null || title === void 0 ? void 0 : title.trim())
            post.title = title.trim();
        if (description === null || description === void 0 ? void 0 : description.trim())
            post.description = description.trim();
        if (content === null || content === void 0 ? void 0 : content.trim())
            post.content = content.trim();
        // Handle image update
        if ((imageUrl === null || imageUrl === void 0 ? void 0 : imageUrl.trim()) && (imagePublicId === null || imagePublicId === void 0 ? void 0 : imagePublicId.trim())) {
            // Delete old image from Cloudinary if it exists
            if (post.imagePublicId && post.imagePublicId !== imagePublicId) {
                try {
                    yield cloudinary_1.cloudinary.uploader.destroy(post.imagePublicId, {
                        resource_type: "image",
                        invalidate: true,
                    });
                }
                catch (error) {
                    console.error("Error deleting old image from Cloudinary:", error);
                    // Continue with update even if deletion fails
                }
            }
            post.imageUrl = imageUrl.trim();
            post.imagePublicId = imagePublicId.trim();
        }
        // 👇 insert this block right before save
        if (category === null || category === void 0 ? void 0 : category.trim()) {
            post.category = category.trim();
            post.categorySlug = (0, slugify_1.default)(post.category, { lower: true, strict: true });
        }
        const updated = yield post.save();
        // Fetch the updated post with populated author field
        const populatedPost = yield post_model_1.default.findById(postId)
            .populate("author", "name email avatarUrl")
            .lean();
        res.status(200).json(populatedPost);
    }
    catch (err) {
        next(err);
    }
});
exports.updatePost = updatePost;
const deletePost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            res.status(400).json({ message: "Invalid post ID" });
            return;
        }
        const post = yield post_model_1.default.findById(id);
        if (!post) {
            res.status(404).json({ message: "Post not found" });
            return;
        }
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isAdmin) && String(post.author) !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id)) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        if (post.imagePublicId) {
            yield cloudinary_1.cloudinary.uploader.destroy(post.imagePublicId, {
                resource_type: "image",
                invalidate: true,
            });
        }
        yield post.deleteOne();
        res.status(200).json({ message: "Post deleted successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.deletePost = deletePost;
// Upload image for existing post
const uploadImage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log('Upload Image Request:', {
            body: req.body,
            file: req.file,
            user: req.user
        });
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { postId } = req.body;
        if (!postId) {
            console.log('Missing postId in request body');
            res.status(400).json({ message: "Post ID is required" });
            return;
        }
        // Check if post exists and user owns it
        const post = yield post_model_1.default.findById(postId);
        if (!post) {
            console.log('Post not found:', postId);
            res.status(404).json({ message: "Post not found" });
            return;
        }
        if (!req.user.isAdmin && String(post.author) !== req.user.id) {
            console.log('User not authorized to modify post:', { userId: req.user.id, postAuthor: post.author });
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        const file = req.file;
        if (!file) {
            console.log('No file in request');
            res.status(400).json({ message: "Image file is required" });
            return;
        }
        console.log('File details:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        // Upload to Cloudinary
        const { url, publicId } = yield (0, upload_image_1.uploadImage)(file.buffer, file.originalname, { folder: "posts", publicIdBase: req.body.title || "post" });
        console.log('Cloudinary upload successful:', { url, publicId });
        res.status(200).json({
            url,
            publicId,
            message: "Image uploaded successfully"
        });
    }
    catch (error) {
        console.error('Upload Image Error:', error);
        res.status(500).json({
            message: "Failed to upload image",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
exports.uploadImage = uploadImage;
