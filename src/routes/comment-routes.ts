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

/**
 * @openapi
 * /api/comments/{postId}/roots:
 *   get:
 *     summary: Get root comments for a post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of root comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 */
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


