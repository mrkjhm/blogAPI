import { Document, Types } from "mongoose";

export interface IPost extends Document {
  author: Types.ObjectId;
  title: string;
  imageUrl: string;
  imagePublicId: string;
  description: string;
  content: string;
  comments: Types.ObjectId[];
  createdAt: Date;
  slug: string;
  category: string;
  categorySlug: string;
}
