import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as rolecontroller from "../controllers/role.controller";

const router = Router();
router.post("/create-role" , rolecontroller.createRole);
router.get("/get-roles", authenticate , rolecontroller.getRoles);
router.get("/get-roles-role-by-id", authenticate , rolecontroller.getRoleById);
router.put("/update-role", authenticate , rolecontroller.updateRole);
router.delete("/delete-role", authenticate , rolecontroller.deleteRole);
// router.post("/refreshToken", authenticate , clientcontroller.refreshToken);

export default router;