import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as paymentcontroller from "../controllers/payment.controller";

const router = Router();

router.post("/connect", authenticate, paymentcontroller.getRazorpayConnectUrl);
router.post("/oauth", authenticate, paymentcontroller.connectRazorpay);
router.get("/status", authenticate, paymentcontroller.getRazorpayStatus);
router.delete("/disconnect", authenticate, paymentcontroller.disconnectRazorpay);
router.post("/create-payment", authenticate, paymentcontroller.createInvoicePayment);
router.post("/verify", authenticate, paymentcontroller.verifyPayment);
router.get("/get-payment-details", authenticate, paymentcontroller.getPaymentDetails);
// router.post("/webhook", paymentcontroller.razorpayWebhook);


export default router;