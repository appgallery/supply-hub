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

        const offset = Number(req.query.offset) || 0;
        const limit = Number(req.query.limit) || 10;

        const result = await clientService.getClients(offset, limit);

        return res.status(200).json({
            status: true,
            message: "Clients fetched successfully.",
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            data: result.data
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message || "Internal server error",
            data: null,
        });

    }
};

export const updateClient = async (
    req: Request,
    res: Response
) => {
    try {

        const clientId = Number(req.query.clientId);

        if (!clientId || isNaN(clientId)) {
            return res.status(400).json({
                success: false,
                message: "Valid clientId is required.",
            });
        }

        const result = await clientService.updateClient(
            clientId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                client: result.client,
                owner: result.owner,
                user: result.user,
            },
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update client.",
        });

    }
};

export const deleteClient = async (
    req: Request,
    res: Response
) => {
    try {

        const clientId = Number(req.query.clientId);

        if (!clientId || isNaN(clientId)) {
            return res.status(400).json({
                success: false,
                message: "Valid clientId is required.",
            });
        }

        const result = await clientService.deleteClient(clientId);

        return res.status(200).json({
            success: true,
            message: result.message,
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message,
        });

    }
};