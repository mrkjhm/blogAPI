// src/routes/comment-routes.ts
import { Router } from "express";
import {
  addComment,
  addReply,
  getCommentsTree,
  getReplies,
  getRootComments,
  // getComment,
  getThread,
  softDeleteComment,
  updateComment
} from "../controller/comment-controller";
import { requireAuth } from "../middleware/auth-jwt";

const router = Router();

// create comment / reply
router.post("/:postId", requireAuth, addComment);
router.post("/:postId/replies/:parentId", requireAuth, addReply);
router.patch("/:commentId/", requireAuth, updateComment);


// read comments
// router.get("/:commentId", getComment)
router.get("/:postId/roots", getRootComments);   // paginated roots
router.get("/replies/:commentId", getReplies);   // paginated replies
router.get("/:postId/tree", getCommentsTree);    // full tree (optional)
router.delete("/:commentId", requireAuth, softDeleteComment);

router.get("/:postId/threads/:rootId", getThread);

export default router;


