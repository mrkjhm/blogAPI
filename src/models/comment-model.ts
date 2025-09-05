import mongoose, { Schema } from "mongoose";
import { IComment } from "../types/comment";

const CommentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    comment: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },

    parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    rootId: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    depth: { type: Number, default: 0, min: 0 },

    // soft-delete
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // edits
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: any) {
        if (ret.deleted) ret.comment = "This comment has been deleted";
        delete ret.deleted;
        delete ret.deletedAt;
        delete ret.deletedBy;
        return ret;
      },
    },
  }
);

// helpful/performant indexes
CommentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });
CommentSchema.index({ postId: 1, createdAt: 1 }, { partialFilterExpression: { deleted: false } });
CommentSchema.index({ userId: 1, createdAt: 1 });

const Comment =
  (mongoose.models.Comment as mongoose.Model<IComment>) ||
  mongoose.model<IComment>("Comment", CommentSchema);

export default Comment;
