import { Router } from "express";
import {
  createPost,
  deletePost,
  getPostById,
  getPostBySlug,
  getPosts,
  updatePost,
  uploadImage,
} from "../controller/post-controller";
import { requireAuth } from "../middleware/auth-jwt";
import { uploadPostImage } from "../middleware/multer-config";

const router = Router();

/**
 * @openapi
 * /api/posts:
 *   get:
 *     summary: List posts
 *     tags: [Posts]
 *     responses:
 *       200:
 *         description: List of posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 */
router.get("/", getPosts);
router.get("/:id", getPostById);
router.post("/", requireAuth, uploadPostImage, createPost);
router.post("/upload-image", requireAuth, uploadPostImage, uploadImage);
router.patch("/:id", requireAuth, updatePost);
router.delete("/:id", requireAuth, deletePost);
router.get("/slug/:slug", getPostBySlug);

export default router;
