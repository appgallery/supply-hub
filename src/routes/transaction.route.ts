import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as transactioncontroller from "../controllers/transaction.controller";

const router = Router();

// router.post("/checkout", authenticate, transactioncontroller.checkout);

export default router;