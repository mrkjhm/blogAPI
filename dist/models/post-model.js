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
// src/models/post-model.ts
const mongoose_1 = __importStar(require("mongoose"));
const comment_model_1 = __importDefault(require("./comment-model"));
// const AuthorSnapshotSchema = new Schema(
//   {
//     name: { type: String, required: true },
//     avatarUrl: { type: String },
//   },
//   { id: false }
// );
const postSchema = new mongoose_1.Schema({
    author: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true, trim: true }, // e.g., "Tech"
    categorySlug: { type: String, required: true, trim: true, lowercase: true, index: true }, // e.g., "tech"
    comments: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Comment", default: [] }],
}, { timestamps: true });
// Fast lists: by category (multikey) then newest
postSchema.index({ categories: 1, createdAt: -1 });
// Optional explicit unique index on slug:
// postSchema.index({ slug: 1 }, { unique: true });
// Optional lists by author:
// postSchema.index({ author: 1, createdAt: -1 });
// Helper: delete all comments for a postId (with optional session)
function deleteCommentsByPostId(postId, session) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = comment_model_1.default.deleteMany({ postId });
        if (session)
            query.session(session);
        yield query;
    });
}
// Hooks
postSchema.pre("findOneAndDelete", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const filter = this.getFilter();
            const id = filter._id;
            const session = (((_a = this.getOptions) === null || _a === void 0 ? void 0 : _a.call(this).session) || undefined);
            if (id)
                yield deleteCommentsByPostId(new mongoose_1.Types.ObjectId(id), session);
            next();
        }
        catch (err) {
            next(err);
        }
    });
});
postSchema.pre("deleteOne", { document: false, query: true }, function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const filter = this.getFilter();
            const id = filter._id;
            const session = (((_a = this.getOptions) === null || _a === void 0 ? void 0 : _a.call(this).session) || undefined);
            if (id)
                yield deleteCommentsByPostId(new mongoose_1.Types.ObjectId(id), session);
            next();
        }
        catch (err) {
            next(err);
        }
    });
});
postSchema.pre("deleteOne", { document: true, query: false }, function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const session = (_b = (_a = this).$session) === null || _b === void 0 ? void 0 : _b.call(_a);
            yield deleteCommentsByPostId(this._id, session);
            next();
        }
        catch (err) {
            next(err);
        }
    });
});
exports.default = mongoose_1.default.models.Post ||
    mongoose_1.default.model("Post", postSchema);
