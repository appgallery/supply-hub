import { Request, Response, NextFunction } from "express";
import * as clientService from "../services/client.service";

export const createClient = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = (req as any).user.userId;
        const result = await clientService.createClient(req.body, userId);

        return res.status(201).json({
            status: true,
            message: "Client created successfully",
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};

export const getClients = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await clientService.getClients();

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            status: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};