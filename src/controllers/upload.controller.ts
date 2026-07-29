import { Request, Response } from "express";
import * as uploadService from "../services/upload.service";

export const uploadFile = async (
    req: Request,
    res: Response
) => {
    try {
        const file = (req as any).file;
        const { folder } = req.body;

        if (!file) {
            return res.status(400).json({
                status: false,
                message: "Please select a file.",
            });
        }

        if (!folder) {
            return res.status(400).json({
                status: false,
                message: "Folder is required.",
            });
        }

        const result = await uploadService.uploadFile(
            file,
            folder
        );

        return res.status(200).json({
            status: true,
            message: "File uploaded successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};