import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/create-category", authenticate, categoryController.createCategoryController);

router.get("/get-categories", authenticate, categoryController.getCategoriesController);

router.get("/get-category-by-id", authenticate, categoryController.getCategoryByIdController);

router.put("/update-category", authenticate, categoryController.updateCategoryController);

router.delete("/delete-category", authenticate, categoryController.deleteCategoryController);

router.get("/generate-category-xml",authenticate, categoryController.generateCategoryXmlController);

router.get("/read-category-from-tally",authenticate, categoryController.readCategoryController);

export default router; 