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