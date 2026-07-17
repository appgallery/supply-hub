import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as clientcontroller from "../controllers/client.controller";

const router = Router();

router.post("/create-client" , authenticate,clientcontroller.createClient);
router.get("/get-clients", authenticate , clientcontroller.getClients);
// router.post("/refreshToken", authenticate , clientcontroller.refreshToken);

export default router;