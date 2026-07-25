import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as clientcontroller from "../controllers/client.controller";

const router = Router();

router.post("/create-client" , authenticate,clientcontroller.createClient);
router.get("/get-clients", authenticate , clientcontroller.getClients);
router.put("/update-client", authenticate , clientcontroller.updateClient);
router.delete("/delete-client", authenticate , clientcontroller.deleteClient);


export default router;