import { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import slugify from "slugify";
import { cloudinary } from "../config/cloudinary";
import Comment from "../models/comment-model";
import Post from "../models/post-model";
import { uploadImage as uploadToCloudinary } from "../utils/upload-image";

interface CreatePostBody {
  author: string;
  title: string;
  imageUrl: string;
  imagePublicId: string;
  description: string;
  content: string;
  category: string;
}

interface UpdatePostBody {
  title: string;
  imageUrl?: string;
  imagePublicId?: string;
  description: string;
  content: string;
  category?: string;
}

export const createPost = async (
  req: Request<unknown, unknown, CreatePostBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, content, category } = (req.body ?? {}) as CreatePostBody;

    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id)) {
      res.status(401).json({ message: "Unauthorized user" });
      return;
    }

    if (!title?.trim() || !description?.trim() || !content?.trim() || !category?.trim()) {
      res.status(400).json({ message: "All fields are required (including category)" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ message: "Image file is required" });
      return;
    }

    const { url, publicId } = await uploadToCloudinary(
      file.buffer,
      file.originalname,
      { folder: "posts", publicIdBase: title, }
    );

    // ✅ Generate unique slug from title
    const baseSlug = slugify(title, { lower: true, strict: true });
    let uniqueSlug = baseSlug;
    let counter = 1;

    // Ensure uniqueness
    while (await Post.exists({ slug: uniqueSlug })) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }

    const categorySlug = slugify(category, { lower: true, strict: true });

    // ✅ Create post with generated slug
    const created = await Post.create({
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
  } catch (error) {
    next(error);
  }
};

// Plain shape of a comment after .lean() + populate("userId")
type CommentLean = {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId:
  | Types.ObjectId
  | { _id: Types.ObjectId; name: string; email?: string; avatar?: string };
  comment: string;
  parentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

// Build a nested tree for one post's comments
function buildTree(rows: CommentLean[]) {
  type Node = CommentLean & { replies: Node[] };
  const map = new Map<string, Node>();
  const roots: Node[] = [];

  rows.forEach((r) => map.set(String(r._id), { ...r, replies: [] }));

  rows.forEach((r) => {
    const id = String(r._id);
    const pid = r.parentId ? String(r.parentId) : null;
    if (pid && map.has(pid)) map.get(pid)!.replies.push(map.get(id)!);
    else roots.push(map.get(id)!);
  });

  return roots;
}

export const getPosts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .populate("author", "name avatarUrl")
      .lean<{ _id: Types.ObjectId; author: { _id: Types.ObjectId; name: string; avatarUrl?: string } }[]>();

    if (posts.length === 0) return res.status(200).json([]);

    const postIds = posts.map((p) => p._id);

    const comments = await Comment.find({ postId: { $in: postIds } })
      .select("-deleted -deletedAt -deletedBy -createdAt -updatedAt -__v")
      .populate("userId", "name email avatarUrl")
      .sort({ createdAt: 1 })
      .lean<CommentLean[]>();

    const byPost = new Map<string, CommentLean[]>();
    comments.forEach((c) => {
      const key = String(c.postId);
      if (!byPost.has(key)) byPost.set(key, []);
      byPost.get(key)!.push(c);
    });

    const result = posts.map((p) => {
      const rows = byPost.get(String(p._id)) ?? [];
      const commentsTree = buildTree(rows);
      return { ...p, commentsTree };
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


export const getPostById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid post ID" });
      return;
    }

    // 1) Get the post itself (lean for perf)
    const post = await Post.findById(new Types.ObjectId(id)).lean();
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // 2) Get all comments for this post and build a nested tree
    const rows = await Comment.find({ postId: new Types.ObjectId(id) })
      .populate("userId", "name email avatar")
      .sort({ createdAt: 1 })
      .lean<CommentLean[]>();

    const commentsTree = buildTree(rows);

    // 3) Return post + nested comments (omit flat post.comments if you want)
    res.status(200).json({
      ...post,
      commentsTree, // <- use this on the frontend
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/posts/slug/:slug
export const getPostBySlug = async (
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slug } = req.params;

    const post = await Post.findOne({ slug })
      .populate("author", "name email avatarUrl") // ✅ this enables full author data
      .lean();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const rows = await Comment.find({ postId: post._id })
      .sort({ createdAt: 1 }) // newest first
      .populate("userId", "name email avatar") // (author → userId for comments)
      .lean<CommentLean[]>();

    const commentsTree = buildTree(rows);

    res.status(200).json({
      ...post,
      commentsTree,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePost = async (
  req: Request<{ id: string }, unknown, UpdatePostBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postId = req.params.id;

    if (!mongoose.isValidObjectId(postId)) {
      res.status(400).json({ message: "Invalid post ID" });
      return;
    }

    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id)) {
      res.status(401).json({ message: "Unauthorized user" });
      return;
    }



    // 🔑 fetch the post first so we can check ownership/admin
    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // ✅ allow only if admin OR owner
    if (!req.user.isAdmin && String(post.author) !== req.user.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const { title, description, content, imageUrl, imagePublicId, category } = req.body ?? {};

    // set only if provided (avoid overwriting with undefined)
    if (title?.trim()) post.title = title.trim();
    if (description?.trim()) post.description = description.trim();
    if (content?.trim()) post.content = content.trim();

    // Handle image update
    if (imageUrl?.trim() && imagePublicId?.trim()) {
      // Delete old image from Cloudinary if it exists
      if (post.imagePublicId && post.imagePublicId !== imagePublicId) {
        try {
          await cloudinary.uploader.destroy(post.imagePublicId, {
            resource_type: "image",
            invalidate: true,
          });
        } catch (error) {
          console.error("Error deleting old image from Cloudinary:", error);
          // Continue with update even if deletion fails
        }
      }

      post.imageUrl = imageUrl.trim();
      post.imagePublicId = imagePublicId.trim();
    }

    // 👇 insert this block right before save
    if (category?.trim()) {
      post.category = category.trim();
      post.categorySlug = slugify(post.category, { lower: true, strict: true });
    }

    const updated = await post.save();

    // Fetch the updated post with populated author field
    const populatedPost = await Post.findById(postId)
      .populate("author", "name email avatarUrl")
      .lean();

    res.status(200).json(populatedPost);
  } catch (err) {
    next(err);
  }
};

export const deletePost = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid post ID" });
      return;
    }

    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (!req.user?.isAdmin && String(post.author) !== req.user?.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    if (post.imagePublicId) {
      await cloudinary.uploader.destroy(post.imagePublicId, {
        resource_type: "image",
        invalidate: true,
      });
    }

    await post.deleteOne();

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Upload image for existing post
export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {

    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { postId } = req.body;
    if (!postId) {
      res.status(400).json({ message: "Post ID is required" });
      return;
    }

    // Check if post exists and user owns it
    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (!req.user.isAdmin && String(post.author) !== req.user.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {

      res.status(400).json({ message: "Image file is required" });
      return;
    }



    // Upload to Cloudinary
    const { url, publicId } = await uploadToCloudinary(
      file.buffer,
      file.originalname,
      { folder: "posts", publicIdBase: req.body.title || "post" }
    );

    res.status(200).json({
      url,
      publicId,
      message: "Image uploaded successfully"
    });
  } catch (error) {
    console.error('Upload Image Error:', error);
    res.status(500).json({
      message: "Failed to upload image",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
