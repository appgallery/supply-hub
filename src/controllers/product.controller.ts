import { Request, Response } from "express";
import { createProduct, getDealerProducts, getProductById, getProducts, toggleProductStatus, updateProduct } from "../services/product.service"
import { AuthRequest } from "../middleware/auth.middleware";

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
        console.log("Controller started");

        const userId = (req as any).user.userId;

        const categoryId = req.query.categoryId
            ? Number(req.query.categoryId)
            : undefined;

        const search = req.query.search
            ? String(req.query.search)
            : undefined;

        const sortBy = (req.query.sortBy as
            | "productId"
            | "name"
            | "createdAt"
            | "price_low"
            | "price_high"
            | "most_sold") || "productId";

        const sortOrder = (req.query.sortOrder as
            | "ASC"
            | "DESC") || "DESC";

        const offset = Number(req.query.offset) || 0;
        const limit = Number(req.query.limit) || 10;

        console.log("Pagination params:", {
            offset,
            limit,
        });

        const response = await getProducts(
            userId,
            categoryId,
            search,
            sortBy,
            sortOrder,
            offset,
            limit
        );

        console.log("Service completed");

        return res.status(200).json({
            status: true,
            message: "Product fetched successfully...",
            total: response.total,
            offset: response.offset,
            limit: response.limit,
            data: response.products,
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

        const offset = Number(req.query.offset) || 0;
        const limit = Number(req.query.limit) || 10;

        const response = await getDealerProducts(
            userId,
            offset,
            limit
        );

        return res.status(200).json({
            status: true,
            message: "Dealer products fetched successfully...",
            total: response.total,
            offset: response.offset,
            limit: response.limit,
            data: response.products,
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

export const toggleProductStatusController = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;
        const roleName = req.user.roleName;
        const productId = Number(req.query.productId);

        const response = await toggleProductStatus(
            productId,
            userId,
            roleName
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