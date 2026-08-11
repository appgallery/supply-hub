import { Response } from "express";
import { createOrder, deleteOrder, getAdminDashboard, getClientDashboard, getOrderById, getOrders, updateOrder, updateOrderStatus } from "../services/order.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const CreateOrdersController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await createOrder(
            req.body,
            req.user!.userId
        );

        return res.status(201).json({
            status: true,
            message: "Order created successfully.",
            data: result,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getOrdersController = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const result = await getOrders(
            req.query,
            req.user!.userId
        );

        return res.status(200).json({
            status: true,
            message: "Order Fetched Successfully.",
            offset: result.offset,
            limit: result.limit,
            count: result.count,
            data: result.orders,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getOrderByIdController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await getOrderById(
            Number(req.query.orderId),
            req.user!.userId
        );

        return res.status(200).json({
            status: true,
            message: "Order fetched successfully.",
            data: result,
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message,
        });

    }
};

export const deleteOrderController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        await deleteOrder(
            Number(req.query.orderId),
            req.user!.userId
        );

        return res.status(200).json({
            status: true,
            message: "Order deleted successfully.",
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message,
        });

    }
};

export const updateOrderController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await updateOrder(
            Number(req.query.orderId),
            req.body,
            req.user!.userId
        );

        return res.status(200).json({
            status: true,
            message: "Order updated successfully.",
            data: result,
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message,
        });

    }
};

export const getClientDashboardController = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const clientId = req.user!.clientId;
        const result = await getClientDashboard(
            clientId
        );

        return res.status(200).json({
            status: true,
            message: "Dashboard fetched successfully.",
            data: result,
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message,
        });

    }
};

export const getAdminDashboardController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await getAdminDashboard(
            req.user!.userId
        );

        return res.status(200).json({
            status: true,
            message: "Dashboard fetched successfully.",
            data: result,
        });

    } catch (error: any) {

        return res.status(500).json({
            status: false,
            message: error.message,
        });

    }
};

export const updateOrderStatusController = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const orderId = Number(req.query.orderId);

        const userId = req.user.userId;

        const order = await updateOrderStatus(
            orderId,
            req.body,
            userId
        );


        return res.status(200).json({
            status: true,
            message: "Order status updated successfully.",
            order,
        });


    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message,
        });

    }
};