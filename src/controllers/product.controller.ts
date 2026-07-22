import { Request, Response } from "express";
import { createProduct, deleteProduct, getProductById, getProducts, updateProduct } from "../services/product.service"

export const createProductController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await createProduct(req.body, userId);

        return res.status(201).json({
            success: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

export const getProductController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await getProducts(userId);

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
}

export const getProductByIdController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await getProductById(Number(req.query.productId), userId);

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
}

export const updateProductController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await updateProduct(Number(req.query.productId), req.body, userId);

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
}

export const deleteProductController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await deleteProduct(Number(req.query.productId), userId);

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
}