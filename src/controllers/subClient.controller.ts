import { Request, Response } from "express";
import * as subClientService from "../services/subclient.service";

export const createSubClient = async (
    req: Request,
    res: Response,
) => {
    try {
        const userId = (req as any).user.userId;
        const result = await subClientService.createSubClient(
            req.body,
            userId
        );


        return res.status(201).json({
            status: true,
            message: "Sub client created successfully",
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

export const getSubClients = async (
    req: Request,
    res: Response,
) => {
    try {
        const result = await subClientService.getSubClients(Number(req.query.clientId));

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