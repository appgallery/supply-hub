import { Request, Response } from "express";
import * as paymentService from "../services/payment.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const createPayment = async (
    req: Request,
    res: Response
) => {
    try {
        const { invoiceId } = req.body;

        if (!invoiceId) {
            return res.status(400).json({
                success: false,
                message: "Invoice Id is required.",
            });
        }

        const result = await paymentService.createPayment(invoiceId);

        return res.status(200).json({
            success: true,
            message: "Payment order created successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
export const verifyPayment = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const userId = req.user.userId;

        const result = await paymentService.verifyPayment(
            req.body,
            userId
        );

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message,
        });

    }
};

export const getPaymentDetails = async (
    req: Request,
    res: Response
) => {
    try {
        const transactionId = Number(req.query.transactionId);

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Transaction Id is required.",
            });
        }

        const result = await paymentService.getPaymentDetails(transactionId);

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message,
        });

    }
};

// export const razorpayWebhook = async (
//     req: Request,
//     res: Response
// ) => {
//     try {

//         await paymentService.razorpayWebhook(
//             req.body,
//             req.headers["x-razorpay-signature"] as string
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Webhook processed successfully.",
//         });

//     } catch (error: any) {

//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });

//     }
// };