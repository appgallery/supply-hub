import { Request, Response } from "express";
import { createCategory, deleteCategory, generateCategoryXml, getCategories, getCategoryById, readCategoriesFromTallyService, updateCategory } from "../services/category.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const createCategoryController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = (req as any).user.userId;

        const data = await createCategory(
            req.body,
            userId
        );

        return res.status(201).json({
            status: true,
            message: "Category created successfully.",
            data,
        });
    } catch (error: any) {
        return res.status(400).json({
            status: false,
            message: error.message,
        });
    }
};

export const getCategoriesController = async (
    req: Request,
    res: Response
) => {
    try {

        const data = await getCategories();

        return res.status(200).json({
            status: true,
            message: "Categories fetched successfully.",
            data,
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message,
        });

    }
};

export const getCategoryByIdController = async (
    req: Request,
    res: Response
) => {
    try {

        const data = await getCategoryById(
            Number(req.query.id)
        );

        return res.status(200).json({
            status: true,
            message: "Category fetched successfully.",
            data,
        });

    } catch (error: any) {

        return res.status(404).json({
            status: false,
            message: error.message,
        });

    }
};

export const updateCategoryController = async (
    req: Request,
    res: Response
) => {
    try {

        const userId = (req as any).user.userId;

        const data = await updateCategory(
            Number(req.query.id),
            req.body,
            userId
        );

        return res.status(200).json({
            status: true,
            message: "Category updated successfully.",
            data,
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
            message: error.message,
        });

    }
};

export const deleteCategoryController = async (
    req: Request,
    res: Response
) => {
    try {

        await deleteCategory(
            Number(req.query.id)
        );

        return res.status(200).json({
            status: true,
            message: "Category deleted successfully.",
        });

    } catch (error: any) {

        return res.status(400).json({
            status: false,
            message: error.message,
        });

    }
};

export const generateCategoryXmlController = async (
    req: AuthRequest,
    res: Response
) => {

    try {

        const user = req.user;
        console.log("user", user)

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }


        const result = await generateCategoryXml(
            user.clientId
        );

        return res.status(200).json({
            success: true,
            message: "Category XML generated successfully.",
            data: result
        });


    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const readCategoryController = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const categories = await readCategoriesFromTallyService();

        return res.status(200).json({
            success: true,
            message: "Categories fetched successfully.",
            data: categories
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};