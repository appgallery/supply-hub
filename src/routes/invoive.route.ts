import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as invoiceController from "../controllers/invoice.controller";

const router = Router();

router.get("/get-invoices", authenticate, invoiceController.getInvoicesController);

export default router;