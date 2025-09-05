// models/category-model.ts
import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true }, // SEO key
  description: { type: String, trim: true },
  iconUrl: { type: String, trim: true },
  color: { type: String, trim: true },
  order: { type: Number, default: 0 },           // sort in menus
  isActive: { type: Boolean, default: true },     // soft hide instead of delete
}, { timestamps: true });

export default mongoose.models.Category || mongoose.model("Category", CategorySchema);
