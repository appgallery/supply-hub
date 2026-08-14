import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as ordercontroller from "../controllers/order.controller";

const router = Router();

router.get("/get-admin-dashboard", authenticate, ordercontroller.getAdminDashboardController);

export default router;
