import { Request, Response } from "express";
import { addToCart, deleteCartItem, getCart, updateCartItem } from "../services/cart.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const addToCartController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await addToCart(
            req.body,
            req.user.userId,
            req.user.roleName
        );
        return res.status(201).json({
            status: true,
            message: "Item added to cart successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getCartController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await getCart(
            req.user.userId,
            req.user.roleName
        );

        return res.status(200).json({
            status: true,
            message: "Cart fetched successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const updateCartItemController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await updateCartItem(
            Number(req.query.cartItemId),
            req.body,
            req.user.userId,
            req.user.roleName
        );

        return res.status(200).json({
            status: true,
            message: "Cart item updated successfully.",
            data: result,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const deleteCartItemController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await deleteCartItem(
            Number(req.query.cartItemId),
            req.user.userId,
            req.user.roleName
        );

        return res.status(200).json({
            status: true,
            result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};