import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as sizeController from "../controllers/size.controller";

const router = Router();

router.post("/create-size" , sizeController.createSizeController);
router.get("/get-sizes",  sizeController.getSizeController);
// router.post("/refreshToken", authenticate , clientcontroller.refreshToken);

export default router;