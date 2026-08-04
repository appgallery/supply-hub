import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as paymentcontroller from "../controllers/payment.controller";

const router = Router();

router.post("/create-payment", authenticate, paymentcontroller.createPayment);
router.post("/verify", authenticate, paymentcontroller.verifyPayment);
router.get("/get-payment-details", authenticate, paymentcontroller.getPaymentDetails);
// router.post("/webhook", paymentcontroller.razorpayWebhook);


export default router;