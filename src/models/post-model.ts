// src/models/post-model.ts
import mongoose, { ClientSession, Schema, Types } from "mongoose";
import { IPost } from "../types/post";
import Comment from "./comment-model";

// const AuthorSnapshotSchema = new Schema(
//   {
//     name: { type: String, required: true },
//     avatarUrl: { type: String },
//   },
//   { id: false }
// );

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: true },

    category: { type: String, required: true, trim: true },                // e.g., "Tech"
    categorySlug: { type: String, required: true, trim: true, lowercase: true, index: true }, // e.g., "tech"

    comments: [{ type: Schema.Types.ObjectId, ref: "Comment", default: [] }],
  },
  { timestamps: true }
);

// Fast lists: by category (multikey) then newest
postSchema.index({ categories: 1, createdAt: -1 });
// Optional explicit unique index on slug:
// postSchema.index({ slug: 1 }, { unique: true });
// Optional lists by author:
// postSchema.index({ author: 1, createdAt: -1 });

// Helper: delete all comments for a postId (with optional session)
async function deleteCommentsByPostId(postId: Types.ObjectId, session?: ClientSession) {
  const query = Comment.deleteMany({ postId });
  if (session) query.session(session);
  await query;
}

// Hooks
postSchema.pre("findOneAndDelete", async function (next) {
  try {
    const filter = this.getFilter();
    const id = (filter as any)._id as Types.ObjectId | string | undefined;
    const session = (this.getOptions?.().session || undefined) as ClientSession | undefined;
    if (id) await deleteCommentsByPostId(new Types.ObjectId(id), session);
    next();
  } catch (err) { next(err as any); }
});

postSchema.pre("deleteOne", { document: false, query: true }, async function (next) {
  try {
    const filter = this.getFilter();
    const id = (filter as any)._id as Types.ObjectId | string | undefined;
    const session = (this.getOptions?.().session || undefined) as ClientSession | undefined;
    if (id) await deleteCommentsByPostId(new Types.ObjectId(id), session);
    next();
  } catch (err) { next(err as any); }
});

postSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  try {
    const session = (this as any).$session?.() as ClientSession | undefined;
    await deleteCommentsByPostId(this._id as Types.ObjectId, session);
    next();
  } catch (err) { next(err as any); }
});

export default (mongoose.models.Post as mongoose.Model<IPost>) ||
  mongoose.model<IPost>("Post", postSchema);