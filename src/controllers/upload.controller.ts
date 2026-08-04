import { Request, Response } from "express";
import * as uploadService from "../services/upload.service";

export const uploadFile = async (
    req: Request,
    res: Response
) => {
    try {
        const files = req.files as Express.Multer.File[];
        const { folder } = req.body;

        if (!files || files.length === 0) {
            return res.status(400).json({
                status: false,
                message: "Please select at least one file.",
            });
        }

        if (!folder) {
            return res.status(400).json({
                status: false,
                message: "Folder is required.",
            });
        }

        const uploadedFiles = await uploadService.uploadFiles(
            files,
            folder
        );

        return res.status(200).json({
            status: true,
            message: "Files uploaded successfully.",
            data: uploadedFiles,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};