import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createVariantController, getVariantsController, getVariantByIdController, updateVariantController, deleteVariantController } from "../controllers/variant.controller";

const router = Router();
router.post("/create-variant", authenticate, createVariantController);

router.get("/get-variants", authenticate, getVariantsController);

router.get("/get-variant-by-id", authenticate, getVariantByIdController);

router.put("/update-variant", authenticate, updateVariantController);

router.delete("/delete-variant", authenticate, deleteVariantController);

export default router;