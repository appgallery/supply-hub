import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as authcontroller from "../controllers/auth.controller";

const router = Router();

router.post("/login" , authcontroller.login);
router.post("/logout", authenticate , authcontroller.logout);
router.post("/forgot-password", authcontroller.forgotPassword);
router.post("/reset-password", authcontroller.resetPassword);

export default router;