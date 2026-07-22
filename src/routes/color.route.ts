import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as colorController from "../controllers/color.controller";

const router = Router();

router.post("/create-color" , colorController.createColorController);
router.get("/get-colors", colorController.getColorController);
router.get("/get-color-by-id", colorController.getColorByIdController);
// router.post("/refreshToken", authenticate , clientcontroller.refreshToken);

export default router;