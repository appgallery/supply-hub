import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as subclientcontroller from "../controllers/subClient.controller";

const router = Router();

router.post("/create-sub-client", authenticate , subclientcontroller.createSubClient);
router.get("/get-sub-clients", authenticate , subclientcontroller.getSubClients);
router.get("/get-sub-client-by-id", authenticate , subclientcontroller.getSubClientById);
router.put("/update-sub-clients", authenticate , subclientcontroller.updateSubClient);
router.delete("/delete-sub-clients", authenticate , subclientcontroller.deleteSubClient);
router.get("/get-dealer-dashboard", authenticate , subclientcontroller.getDealerDashboardController);

export default router;