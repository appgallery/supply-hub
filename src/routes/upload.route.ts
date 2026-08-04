import { Router } from "express";
import * as uploadController from "../controllers/upload.controller";
import upload from "../config/multer";

const router = Router();

router.post(
    "/upload-file",
    upload.array("files", 10),
    uploadController.uploadFile
);
export default router;