import { Request, Response } from "express";
import { createSize, getSizes } from "../services/size.service";

export const createSizeController = async (req: Request, res: Response) => {
    try {
        const data = await createSize(req.body);
        return res.status(201).json({
            success: true,
            data: data,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getSizeController = async (req: Request, res: Response) => {
    try {
        const data = await getSizes();
        return res.status(200).json({
            success: true,
            data: data,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};