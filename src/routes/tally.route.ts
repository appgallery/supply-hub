import {
  Router,
} from "express";

import * as tallyController from "../controllers/tally.controller";
import { authenticate } from "../middleware/auth.middleware";

const router =
  Router();


// Your admin/B2B application generates this
router.post("/activation-code", tallyController.createActivationCode);

// Windows .NET connector calls this
router.post("/connector/activate", tallyController.activateConnector);
router.post("/connector/heartbeat", tallyController.heartbeat);
router.get("/connector/status", tallyController.getDeviceStatus);
router.post("/sync", (req, res, next) => {
  console.log("========== /sync ROUTE HIT ==========");
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Body:", req.body);
  next();
}, authenticate, tallyController.createSyncJob);
router.get("/sync/:jobId", tallyController.getSyncJob);
router.patch("/sync/:jobId", tallyController.updateSyncJob);
router.post("/sync/result", tallyController.syncResult);

export default router;