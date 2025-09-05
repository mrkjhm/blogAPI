"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/comment-routes.ts
const express_1 = require("express");
const comment_controller_1 = require("../controller/comment-controller");
const auth_jwt_1 = require("../middleware/auth-jwt");
const router = (0, express_1.Router)();
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
router.post("/:postId", auth_jwt_1.requireAuth, comment_controller_1.addComment);
router.post("/:postId/replies/:parentId", auth_jwt_1.requireAuth, comment_controller_1.addReply);
router.patch("/:commentId/", auth_jwt_1.requireAuth, comment_controller_1.updateComment);
// read comments
// router.get("/:commentId", getComment)
router.get("/:postId/roots", comment_controller_1.getRootComments); // paginated roots
router.get("/replies/:commentId", comment_controller_1.getReplies); // paginated replies
router.get("/:postId/tree", comment_controller_1.getCommentsTree); // full tree (optional)
router.delete("/:commentId", auth_jwt_1.requireAuth, comment_controller_1.softDeleteComment);
router.get("/:postId/threads/:rootId", comment_controller_1.getThread);
exports.default = router;
