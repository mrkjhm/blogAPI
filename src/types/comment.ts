// src/types/comment.ts
import { Document, Types } from "mongoose";

export interface IComment extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  comment: string;
  parentId: Types.ObjectId | null;
  rootId: Types.ObjectId | null;
  depth: number;
  deleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  isEdited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
