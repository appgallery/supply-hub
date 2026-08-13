import { Request, Response } from "express";
import * as subClientService from "../services/subclient.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const createSubClient = async (
    req: AuthRequest,
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
    req: AuthRequest,
    res: Response,
) => {
    try {
        // Get clientId from JWT token
        const clientId = req.user!.clientId;

        const offset = Number(req.query.offset) || 0;
        const limit = Number(req.query.limit) || 10;

        const subClientId = req.query.subClientId
            ? Number(req.query.subClientId)
            : undefined;

        const result = await subClientService.getSubClients(
            clientId,
            offset,
            limit,
            subClientId
        );

        return res.status(200).json({
            status: true,
            message: "Sub clients fetched successfully.",
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            data: result.data,
        });

    } catch (error: any) {
        console.error("Get Sub Clients Error:", error);

        return res.status(500).json({
            status: false,
            message: error.message || "Internal server error",
        });
    }
};

export const getSubClientById = async (
    req: Request,
    res: Response
) => {
    try {

        const subClientId = Number(req.query.subClientId);

        if (!subClientId || isNaN(subClientId)) {
            return res.status(400).json({
                status: false,
                message: "Valid subClientId is required.",
            });
        }

        const data = await subClientService.getSubClientById(subClientId);

        return res.status(200).json({
            status: true,
            message: "Sub client fetched successfully.",
            data,
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
            message: error.message || "Failed to fetch sub client.",
        });

    }
};

export const updateSubClient = async (
    req: Request,
    res: Response
) => {
    try {

        const subClientId = Number(req.query.subClientId);

        if (!subClientId || isNaN(subClientId)) {
            return res.status(400).json({
                status: false,
                message: "Valid subClientId is required.",
            });
        }

        const result = await subClientService.updateSubClient(
            subClientId,
            req.body
        );

        return res.status(200).json({
            status: true,
            message: result.message,
            data: {
                subClient: result.subClient,
                user: result.user,
            },
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
            message: error.message || "Failed to update sub client.",
        });

    }
};

export const deleteSubClient = async (
    req: Request,
    res: Response
) => {
    try {

        const subClientId = Number(req.query.subClientId);

        if (!subClientId || isNaN(subClientId)) {
            return res.status(400).json({
                status: false,
                message: "Valid subClientId is required.",
            });
        }

        const result = await subClientService.deleteSubClient(subClientId);

        return res.status(200).json({
            status: true,
            message: result.message,
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
            message: error.message || "Failed to delete sub client.",
        });

    }
};