import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/create-category", authenticate, categoryController.createCategoryController);

router.get("/get-categories", authenticate, categoryController.getCategoriesController);

router.get("/get-category-by-id", authenticate, categoryController.getCategoryByIdController);

router.put("/update-category", authenticate, categoryController.updateCategoryController);

router.delete("/delete-category", authenticate, categoryController.deleteCategoryController);

export default router;