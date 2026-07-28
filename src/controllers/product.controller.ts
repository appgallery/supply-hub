import { Request, Response } from "express";
import { createProduct, deleteProduct, getDealerProducts, getProductById, getProducts, updateProduct } from "../services/product.service"

export const createProductController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await createProduct(req.body, userId);

        return res.status(201).json({
            status: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
}

export const getProductController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const categoryId = req.query.categoryId
            ? Number(req.query.categoryId)
            : undefined;

        const sortBy = (req.query.sortBy as
            | "productId"
            | "name"
            | "createdAt") || "productId";

        const sortOrder = (req.query.sortOrder as
            | "ASC"
            | "DESC") || "DESC";

        const response = await getProducts(
            userId,
            categoryId,
            sortBy,
            sortOrder
        );

        return res.status(200).json({
            status: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getProductByIdController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await getProductById(Number(req.query.productId), userId);

        return res.status(200).json({
            status: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
}

export const getDealerProductsController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const response = await getDealerProducts(userId);

        return res.status(200).json({
            status: true,
            data: response,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};
export const updateProductController = async (
    req: Request, res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const response = await updateProduct(Number(req.query.productId), req.body, userId);

        return res.status(200).json({
            status: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
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
            status: true,
            data: response,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
}