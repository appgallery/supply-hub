import { Request, Response } from "express";
import { createColor, getColorById, getColors } from "../services/color.service";

export const createColorController = async (req: Request, res: Response) => {
    try {
        const data = await createColor(req.body);
        return res.status(201).json({
            status: true,
            data: data,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getColorController = async (req: Request, res: Response) => {
    try {
        const data = await getColors();
        return res.status(200).json({
            status: true,
            data: data,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getColorByIdController = async (req: Request, res: Response) => {
    try {
        const colorId = Number(req.query.colorId)
        const data = await getColorById(colorId);
        return res.status(200).json({
            status: true,
            data: data,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};