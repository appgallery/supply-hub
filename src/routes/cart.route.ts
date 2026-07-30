import { Router } from "express";
import * as cartController from "../controllers/cart.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/add-to-cart", authenticate, cartController.addToCartController);

router.get("/get-cart", authenticate, cartController.getCartController);

router.put("/update-cart-item", authenticate, cartController.updateCartItemController);

router.delete("/delete-cart", authenticate, cartController.deleteCartItemController);

// router.delete("/delete-category", authenticate, categoryController.deleteCategoryController);

export default router;