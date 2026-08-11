import { Request, Response, NextFunction } from "express";
import * as clientService from "../services/client.service";
import { getRazorpayAccountStatus } from "../services/client.service";
import { AuthRequest } from "../middleware/auth.middleware";

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
        const clientId = req.query.clientId
            ? Number(req.query.clientId)
            : undefined;

        const result = await clientService.getClients(
            offset,
            limit,
            clientId
        );

        return res.status(200).json({
            status: true,
            message: "Clients fetched successfully.",
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            data: result.data,
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
                status: false,
                message: "Valid clientId is required.",
            });
        }

        const result = await clientService.updateClient(
            clientId,
            req.body
        );

        return res.status(200).json({
            status: true,
            message: result.message,
            data: {
                client: result.client,
                owner: result.owner,
                user: result.user,
            },
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
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
                status: false,
                message: "Valid clientId is required.",
            });
        }

        const result = await clientService.deleteClient(clientId);

        return res.status(200).json({
            status: true,
            message: result.message,
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
            message: error.message,
        });

    }
};

export const getClientRazorpayStatus = async (
    req: AuthRequest,
    res: Response
) => {

    try {

        const clientId = req.user.clientId;
        const result =
            await getRazorpayAccountStatus(
                clientId
            );

        return res.status(200).json({
            status: true,
            message: "Razorpay account status fetched successfully.",
            data: result
        });


    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message || "Internal server error",
            data: null,
        });

    }

};