import { Router } from "express";
import * as uploadController from "../controllers/upload.controller";
import upload from "../config/multer";

const router = Router();

router.post(
    "/upload-file",
    upload.single("file"),
    uploadController.uploadFile
);
export default router;