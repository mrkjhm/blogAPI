import { Router } from "express";
import {
  adminUpdateUsername,
  changeEmail,
  changePassword,
  deleteUser,
  getAllUser,
  getProfile,
  getUserByEmail,
  getUserById,
  loginUser,
  refreshToken,
  registerUser,
  updateAvatar,
  // updateUser,
  updateUsername
} from "../controller/user-controller";
import { requireAdmin, requireAuth } from "../middleware/auth-jwt";
import { uploadAvatar } from "../middleware/multer-config";

const router = Router();
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

router.post("/login", loginUser)
router.post("/register", uploadAvatar, registerUser);
router.get("/", requireAuth, requireAdmin, getAllUser);
router.get("/me", requireAuth, getProfile);
router.post("/refresh-token", refreshToken);
router.get("/email/:email", requireAuth, requireAdmin, getUserByEmail);
router.get("/:id", requireAuth, requireAdmin, getUserById);
router.delete("/:id", requireAuth, requireAdmin, deleteUser);
router.put("/:id/", requireAuth, updateUsername);
router.put("/:id/avatar", requireAuth, uploadAvatar, updateAvatar);
router.post("/:id/change-password", requireAuth, changePassword)
router.post("/:id/change-email", requireAuth, changeEmail)    // change email (no verify for portfolio)
router.put("/:id/update-by-admin", requireAuth, requireAdmin, adminUpdateUsername);


export default router;