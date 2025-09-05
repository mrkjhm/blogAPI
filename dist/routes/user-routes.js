"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controller/user-controller");
const auth_jwt_1 = require("../middleware/auth-jwt");
const multer_config_1 = require("../middleware/multer-config");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenPair'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
/**
 * @openapi
 * /api/users/register:
 *   post:
 *     summary: Register user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               avatarUrl: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden
 */
// router.put("/:id/update", verify, uploadAvatar, updateUser);
router.post("/login", user_controller_1.loginUser);
router.post("/register", multer_config_1.uploadAvatar, user_controller_1.registerUser);
router.get("/", auth_jwt_1.requireAuth, auth_jwt_1.requireAdmin, user_controller_1.getAllUser);
router.get("/me", auth_jwt_1.requireAuth, user_controller_1.getProfile);
router.post("/refresh-token", user_controller_1.refreshToken);
router.get("/email/:email", auth_jwt_1.requireAuth, auth_jwt_1.requireAdmin, user_controller_1.getUserByEmail);
router.get("/:id", auth_jwt_1.requireAuth, auth_jwt_1.requireAdmin, user_controller_1.getUserById);
router.delete("/:id", auth_jwt_1.requireAuth, auth_jwt_1.requireAdmin, user_controller_1.deleteUser);
router.put("/:id/", auth_jwt_1.requireAuth, user_controller_1.updateUsername);
router.put("/:id/avatar", auth_jwt_1.requireAuth, multer_config_1.uploadAvatar, user_controller_1.updateAvatar);
router.post("/:id/change-password", auth_jwt_1.requireAuth, user_controller_1.changePassword);
router.post("/:id/change-email", auth_jwt_1.requireAuth, user_controller_1.changeEmail); // change email (no verify for portfolio)
router.put("/:id/update-by-admin", auth_jwt_1.requireAuth, auth_jwt_1.requireAdmin, user_controller_1.adminUpdateUsername);
exports.default = router;
