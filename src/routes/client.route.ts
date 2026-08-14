import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as clientcontroller from "../controllers/client.controller";
import * as ordercontroller from "../controllers/order.controller";


const router = Router();

router.post("/create-client", authenticate, clientcontroller.createClient);
router.get("/get-clients", authenticate, clientcontroller.getClients);
router.put("/update-client", authenticate, clientcontroller.updateClient);
router.delete("/delete-client", authenticate, clientcontroller.deleteClient);
router.get("/get-razor-pay-status", authenticate, clientcontroller.getClientRazorpayStatus);
router.get("/get-client-dashboard", authenticate, ordercontroller.getClientDashboardController);



export default router;