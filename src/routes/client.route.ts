import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as clientcontroller from "../controllers/client.controller";
import * as ordercontroller from "../controllers/order.controller";
import * as paymentcontroller from "../controllers/payment.controller";


const router = Router();

router.post("/create-client", authenticate, clientcontroller.createClient);
router.get("/get-clients", authenticate, clientcontroller.getClients);
router.put("/update-client", authenticate, clientcontroller.updateClient);
router.delete("/delete-client", authenticate, clientcontroller.deleteClient);
router.get("/get-client-dashboard", authenticate, ordercontroller.getClientDashboardController);
router.post(
    "/webhook/razorpay-account-update",
    paymentcontroller.razorpayWebhook
);



export default router;