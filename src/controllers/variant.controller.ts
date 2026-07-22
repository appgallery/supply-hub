import { Request, Response } from "express";
import { createVariant, deleteVariant, getVariantById, getVariants, updateVariant } from "../services/variant.service";

export const createVariantController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const response = await createVariant(req.body, userId);

        return res.status(201).json({
            success: true,
            message: "Variant created successfully.",
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getVariantsController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await getVariants(Number(req.query.productId), userId);

        return res.status(200).json({
            success: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getVariantByIdController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const response = await getVariantById(
            Number(req.query.variantId),
            userId
        );

        return res.status(200).json({
            success: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateVariantController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const response = await updateVariant(
            Number(req.query.variantId),
            req.body,
            userId
        );

        return res.status(200).json({
            success: true,
            message: "Variant updated successfully.",
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const deleteVariantController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const response = await deleteVariant(
            Number(req.query.variantId),
            userId
        );

        return res.status(200).json(response);
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};