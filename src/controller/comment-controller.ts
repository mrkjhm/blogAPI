// src/controller/comment-controller.ts
import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { canModify } from "../lib/authz";
import Comment from "../models/comment-model";
import Post from "../models/post-model";



type UserDTO = { _id: string; name: string; avatarUrl?: string };

export type CommentDTO = {
  _id: string;
  postId: string;
  user: UserDTO;           // <- consistent!
  comment: string;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string | undefined;
  replies?: CommentDTO[];  // when returned as a tree
  isDeleted?: boolean; // <-- add this
};

// comment-controller.ts (or a shared dto file)
export function toDTO(r: any): CommentDTO {
  const rawUser =
    (r.user && typeof r.user === "object" ? r.user : null) ||
    (r.userId && typeof r.userId === "object" ? r.userId : null);

  const userId = rawUser?._id ?? r.userId;
  const name = typeof rawUser?.name === "string" && rawUser.name.trim()
    ? rawUser.name.trim()
    : "Unknown";
  const avatarUrl =
    typeof rawUser?.avatarUrl === "string" && rawUser.avatarUrl.trim()
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
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : new Date(r.createdAt).toISOString(),
    isEdited: r.isEdited ?? false,
    editedAt: r.editedAt ? new Date(r.editedAt).toISOString() : undefined,
    isDeleted, // <--- expose for UI logic
  };
}



// Build tree from already-normalized flat rows
export function buildTreeDTO(rows: CommentDTO[]): CommentDTO[] {
  const map = new Map<string, CommentDTO & { replies: CommentDTO[] }>();
  rows.forEach((r) => map.set(r._id, { ...r, replies: [] }));

  const roots: (CommentDTO & { replies: CommentDTO[] })[] = [];

  for (const r of map.values()) {
    if (r.parentId && map.has(r.parentId)) {
      map.get(r.parentId)!.replies.push(r);
    } else {
      roots.push(r);
    }
  }

  // sort newest-first recursively
  const sortDesc = (arr: (CommentDTO & { replies: CommentDTO[] })[]) => {
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    arr.forEach((n) => sortDesc(n.replies as (CommentDTO & { replies: CommentDTO[] })[]));
  };
  sortDesc(roots);

  return roots;
}

function parseLimit(q: unknown, fallback = 10, max = 50): number {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}



async function computeThreadMeta(postId: string, parentId?: string) {
  if (!parentId) return { parentObjId: null, rootId: null, depth: 0 };

  if (!Types.ObjectId.isValid(parentId)) {
    throw Object.assign(new Error("Invalid parentId"), { status: 400 });
  }

  const parent = await Comment.findById(parentId)
    .select("postId deleted rootId depth")
    .lean<{
      _id: Types.ObjectId;
      postId: Types.ObjectId;
      deleted: boolean;
      rootId: Types.ObjectId | null;
      depth?: number
    }>();

  if (!parent || String(parent.postId) !== String(postId)) {
    throw Object.assign(new Error("Invalid parentId for this post"), { status: 400 });
  }
  if (parent.deleted) {
    throw Object.assign(new Error("Cannot reply to a deleted comment"), { status: 400 });
  }

  const rootId = parent.rootId ?? parent._id;
  const depth = (parent.depth ?? 0) + 1;
  return { parentObjId: parent._id, rootId, depth };
}


// ------ CREATE ------
type CreateCommentBody = {
  comment: string; parentId?: string
};
const MAX_DEPTH = 3;


export const addComment = async (
  req: Request<{ postId: string }, {}, CreateCommentBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postId } = req.params;
    const { comment, parentId } = req.body;

    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!Types.ObjectId.isValid(postId)) return res.status(400).json({ message: "Invalid postId" });

    const text = comment?.trim();
    if (!text) return res.status(400).json({ message: "Comment is required" });

    const post = await Post.findById(postId).select("_id");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const { parentObjId, rootId, depth } = await computeThreadMeta(postId, parentId);
    // if (depth > MAX_DEPTH) return res.status(400).json({ message: `Max reply depth is ${MAX_DEPTH}` });

    const session = await Comment.startSession();
    session.startTransaction();
    let createdId: Types.ObjectId;
    try {
      const created = await new Comment({
        postId: post._id,
        userId: new Types.ObjectId(req.user.id),
        comment: text,
        parentId: parentObjId,
        rootId,
        depth,
      }).save({ session });

      createdId = created._id as Types.ObjectId;

      await Post.findByIdAndUpdate(post._id, { $push: { comments: created._id } }, { session });

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    // fetch populated & return DTO
    const saved = await Comment.findById(createdId)
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt")
      .populate("userId", "name avatarUrl")
      .lean();

    res.status(201).json({
      message: "Comment added",
      comment: saved ? toDTO(saved) : null,
    });
  } catch (error) {
    next(error)
  }
};





export const addReply = async (
  req: Request<{ postId: string; parentId: string }, {}, { comment: string }>,
  res: Response
): Promise<void> => {
  try {
    const { postId, parentId } = req.params;
    const { comment } = req.body;

    if (!req.user?.id) { res.status(401).json({ message: "Unauthorized" }); return; }
    if (!comment?.trim()) { res.status(400).json({ message: "Comment is required" }); return; }
    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(parentId)) {
      res.status(400).json({ message: "Invalid ids" }); return;
    }

    const parent = await Comment.findById(parentId)
      .select("postId deleted rootId depth")
      .lean<{ _id: Types.ObjectId; postId: Types.ObjectId; deleted: boolean; rootId: Types.ObjectId | null; depth?: number }>();

    if (!parent || String(parent.postId) !== String(postId)) {
      res.status(400).json({ message: "Invalid parentId for this post" }); return;
    }
    if (parent.deleted && !req.user.isAdmin) {
      res.status(400).json({ message: "Cannot reply to a deleted comment" }); return;
    }

    const rootId = parent.rootId ?? parent._id;
    const depth = (parent.depth ?? 0) + 1;


    const reply = await Comment.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(req.user.id),
      comment: comment.trim(),
      parentId: new Types.ObjectId(parentId),
      rootId,
      depth,
    });
    await Post.findByIdAndUpdate(postId, { $push: { comments: reply._id } });

    const populated = await Comment.findById(reply._id)
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt")
      .populate("userId", "name avatarUrl")
      .lean();

    res.status(201).json({
      message: "Reply added",
      comment: populated ? toDTO(populated) : null,
    });
  } catch (e) {
    res.status(500).json({ message: "Error adding reply", error: e });
  }
};

// ---------- READ (paginated roots) ----------
export const getRootComments = async (
  req: Request<{ postId: string }, unknown, unknown, { limit?: string; cursor?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ message: "Invalid postId" });
      return;
    }

    const limit = parseLimit(req.query.limit, 10, 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined;

    const filter: Record<string, any> = {
      postId: new Types.ObjectId(postId),
      parentId: null,
      ...(cursor ? { createdAt: { $gt: cursor } } : {}),
    };

    const rows = await Comment.find(filter)
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted")
      .populate("userId", "name avatarUrl")
      .sort({ createdAt: 1 })
      .limit(limit + 1)
      .lean();

    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const data = page.map(toDTO);
    const nextCursor = hasNext && page.length
      ? new Date(page[page.length - 1]!.createdAt).toISOString()
      : null;

    res.json({ data, nextCursor });
  } catch (err) {
    next(err);
  }
};


// ---------- READ (paginated replies for one comment) ----------
export const getReplies = async (
  req: Request<{ commentId: string }, unknown, unknown, { limit?: string; cursor?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.params;
    if (!Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: "Invalid commentId" });
      return;
    }

    const limit = parseLimit(req.query.limit, 10, 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : undefined;

    const filter: Record<string, any> = {
      parentId: new Types.ObjectId(commentId),
      ...(cursor ? { createdAt: { $gt: cursor } } : {}),
    };

    const rows = await Comment.find(filter)
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted")
      .populate("userId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const data = page.map(toDTO);
    const nextCursor = hasNext && page.length
      ? new Date(page[page.length - 1]!.createdAt).toISOString()
      : null;

    res.json({ data, nextCursor });
  } catch (err) {
    next(err);
  }
};

// ---------- READ (full nested tree for a post — use sparingly) ----------
export const getCommentsTree = async (
  req: Request<{ postId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postId } = req.params;
    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ message: "Invalid postId" });
      return;
    }

    const rows = await Comment.find({ postId: new Types.ObjectId(postId) })
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted")
      .populate("userId", "name avatarUrl")
      .sort({ createdAt: 1 })
      .lean();

    const dto = rows.map(toDTO);
    res.json(buildTreeDTO(dto));
  } catch (err) {
    next(err);
  }
};



export const updateComment = async (
  req: Request<{ commentId: string }, {}, { comment: string }>,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;

    if (!req.user?.id) {
      res.status(401).json({
        message: "Unauthorized"
      }); return;
    }
    if (!Types.ObjectId.isValid(commentId)) { res.status(400).json({ message: "Invalid commentId" }); return; }
    if (!comment?.trim()) { res.status(400).json({ message: "Comment is required" }); return; }

    const existing = await Comment.findById(commentId).select("_id userId deleted");
    if (!existing) { res.status(404).json({ message: "Comment not found" }); return; }

    if (!canModify(req, existing.userId)) { res.status(403).json({ message: "Forbidden" }); return; }
    if (existing.deleted && !req.user.isAdmin) {
      res.status(400).json({ message: "Cannot edit a deleted comment" }); return;
    }

    const updated = await Comment.findByIdAndUpdate(
      existing._id,
      { $set: { comment: comment.trim(), isEdited: true, editedAt: new Date() } },
      { new: true }
    )
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt updatedAt")

      .populate("userId", "name avatarUrl")
      .lean();

    res.json({
      message: "Comment updated",
      comment: updated ? toDTO(updated) : null,
    });
  } catch (err) {
    res.status(500).json({ message: "Error updating comment", error: err });
  }
};

// Soft delete (admin or owner)
// ---------- SOFT DELETE (owner or admin) ----------
export const softDeleteComment = async (
  req: Request<{ commentId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { commentId } = req.params;
    if (!Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ message: "Invalid commentId" });
      return;
    }
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // 1) Load minimal fields for authz
    const base = await Comment.findById(commentId).select("_id userId deleted");
    if (!base) { res.status(404).json({ message: "Comment not found" }); return; }
    if (!canModify(req, base.userId)) { res.status(403).json({ message: "Forbidden" }); return; }

    // 2) Guarded update: only if not yet deleted
    const updated = await Comment.findOneAndUpdate(
      { _id: base._id, deleted: false }, // guard vs race
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(req.user.id),
          comment: "This comment has been deleted", // <--- standardize
        },
      },
      {
        new: true,
        projection: "_id comment deleted deletedAt deletedBy",
        lean: true, // bypasses toJSON transform so meta fields are visible
      }
    );

    if (!updated) {
      // either already deleted, or raced — return current state for consistency
      const already = await Comment.findById(commentId)
        .select("_id comment deleted deletedAt deletedBy")
        .lean();
      res.status(200).json({ message: "Already deleted", comment: already });
      return;
    }

    res.status(200).json({ message: "Comment soft-deleted", comment: updated });
  } catch (err) {
    next(err);
  }
};



// ---------- READ (one thread for a post) ----------
export const getThread = async (
  req: Request<{ postId: string; rootId: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postId, rootId } = req.params;
    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(rootId)) {
      res.status(400).json({ message: "Invalid ids" });
      return;
    }

    const rows = await Comment.find({
      postId: new Types.ObjectId(postId),
      $or: [
        { _id: new Types.ObjectId(rootId) },
        { rootId: new Types.ObjectId(rootId) },
      ],
    })
      .select("postId userId comment parentId rootId depth createdAt isEdited editedAt deleted") // +deleted
      .populate("userId", "name avatarUrl")
      .sort({ createdAt: 1 })
      .lean();

    const dto = rows.map(toDTO);
    res.json(buildTreeDTO(dto));
  } catch (err) {
    next(err);
  }
};