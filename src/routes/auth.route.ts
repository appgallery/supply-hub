import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as authcontroller from "../controllers/auth.controller";

const router = Router();

router.post("/login" , authcontroller.login);
router.post("/logout", authenticate , authcontroller.logout);
router.post("/forgot-password", authcontroller.forgotPassword);
router.post("/verify-otp", authcontroller.verifyResetOtpController);
router.post("/reset-password", authcontroller.resetPassword);
router.post("/fcm-token", authenticate, authcontroller.saveFcmTokenController);

export default router;