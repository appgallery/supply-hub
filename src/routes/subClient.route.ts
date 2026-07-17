import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as subclientcontroller from "../controllers/subClient.controller";

const router = Router();

router.post("/create-sub-client", authenticate , subclientcontroller.createSubClient);
router.get("/get-sub-clients", authenticate , subclientcontroller.getSubClients);

export default router;