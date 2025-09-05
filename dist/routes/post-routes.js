"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const post_controller_1 = require("../controller/post-controller");
const auth_jwt_1 = require("../middleware/auth-jwt");
const multer_config_1 = require("../middleware/multer-config");
const router = (0, express_1.Router)();
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
router.get("/", post_controller_1.getPosts);
router.get("/:id", post_controller_1.getPostById);
router.post("/", auth_jwt_1.requireAuth, multer_config_1.uploadPostImage, post_controller_1.createPost);
router.post("/upload-image", auth_jwt_1.requireAuth, multer_config_1.uploadPostImage, post_controller_1.uploadImage);
router.patch("/:id", auth_jwt_1.requireAuth, post_controller_1.updatePost);
router.delete("/:id", auth_jwt_1.requireAuth, post_controller_1.deletePost);
router.get("/slug/:slug", post_controller_1.getPostBySlug);
exports.default = router;
