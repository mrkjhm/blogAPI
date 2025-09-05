// src/types/comment-lean.ts
import { Types } from "mongoose";
import { IComment } from "./comment";

export type PopulatedUser = {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  avatarUrl?: string;
};

export type CommentLean = Omit<IComment, "userId" | "parentId"> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId | PopulatedUser;
  parentId: Types.ObjectId | null;
  rootId?: Types.ObjectId | null;
  depth?: number;
};

export type CommentNode = CommentLean & { replies: CommentNode[] };


export type CommentLeanWithDisplay = CommentLean & {
  displayComment: string;
};
