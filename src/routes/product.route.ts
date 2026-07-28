import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as productController from "../controllers/product.controller";

const router = Router();

router.post("/create-product" , authenticate,productController.createProductController);
router.get("/get-products", authenticate , productController.getProductController);
router.get("/get-product-by-id", authenticate , productController.getProductByIdController);
router.get("/get-dealer-products", authenticate , productController.getDealerProductsController);
router.put("/update-product", authenticate , productController.updateProductController);
router.delete("/delete-product", authenticate , productController.deleteProductController);

export default router;