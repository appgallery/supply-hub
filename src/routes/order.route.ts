import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as ordercontroller from "../controllers/order.controller";

const router = Router();

router.post("/create-order", authenticate, ordercontroller.CreateOrdersController);
router.get("/get-order-by-id", authenticate, ordercontroller.getOrderByIdController);
router.get("/get-orders", authenticate, ordercontroller.getOrdersController);
router.put("/update-order", authenticate, ordercontroller.updateOrderController);
router.delete("/delete-order", authenticate, ordercontroller.deleteOrderController);
router.put("/update-order-status", authenticate, ordercontroller.updateOrderStatusController);
router.put("/select-payment-method", authenticate, ordercontroller.selectPaymentMethodController);

export default router;