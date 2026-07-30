import { Router } from "express";
import * as addressController from "../controllers/address.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/create-address", authenticate, addressController.createAddress);

router.get("/get-address", authenticate, addressController.getAddresses);

router.get("/get-address-by-id", authenticate, addressController.getAddressById);

router.put("/update-address", authenticate, addressController.updateAddress);

router.delete("/delete-address", authenticate, addressController.deleteAddress);


export default router;