import { Request, Response } from "express";
import * as paymentService from "../services/payment.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { createPayment, deleteSubMerchant, exchangeAuthorizationCode, fetchRazorpayStatus, generateRazorpayOAuthUrl, processWebhook, removeRazorpayConnection, verifyRazorpayPayment } from "../services/payment.service";

export const getRazorpayConnectUrl = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.user?.clientId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        const data = await generateRazorpayOAuthUrl(req.user.clientId);

        return res.status(200).json({
            status: true,
            message: "Razorpay OAuth URL generated successfully.",
            data: data,
        });
    } catch (error: any) {
        console.error("Generate Razorpay OAuth URL Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Something went wrong.",
        });
    }
};

export const connectRazorpay = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const clientId = req.user?.clientId;

        if (!clientId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }

        const { code, state } = req.body;

        if (!code || !state) {
            return res.status(400).json({
                success: false,
                message: "Code and state are required.",
            });
        }

        const result = await exchangeAuthorizationCode(
            clientId,
            code
        );

        return res.status(200).json({
            status: true,
            message: "Razorpay connected successfully.",
            data: result,
        });
    } catch (error: any) {
        console.error("Connect Razorpay Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Something went wrong.",
        });
    }
};

export const razorpayWebhook = async (
    req: Request,
    res: Response
) => {
    try {

        console.log("Is Buffer:", Buffer.isBuffer(req.body));

        console.log(
            "Webhook Body:",
            req.body.toString()
        );

        console.log(
            "Signature:",
            req.headers["x-razorpay-signature"]
        );

        const signature = req.headers[
            "x-razorpay-signature"
        ] as string;


        if (!signature) {
            return res.status(400).json({
                success: false,
                message: "Webhook signature missing.",
            });
        }

        await processWebhook(
            req.body,
            signature
        );


        return res.status(200).json({
            success: true,
            message: "Webhook processed successfully.",
        });


    } catch (error: any) {

        console.error(
            "Razorpay Webhook Error:",
            error
        );


        return res.status(400).json({
            success: false,
            message: error.message || "Webhook failed.",
        });
    }
};

export const getRazorpayStatus = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const clientId = req.user?.clientId;

        if (!clientId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }


        const result = await fetchRazorpayStatus(
            clientId
        );


        return res.status(200).json({
            status: true,
            message: "Razorpay status fetched successfully.",
            data: result,
        });


    } catch (error: any) {

        console.error(
            "Get Razorpay Status Error:",
            error
        );


        return res.status(500).json({
            success: false,
            message: error.message || "Something went wrong.",
        });
    }
};

export const deleteRazorpaySubMerchant = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { accountId } = req.query;

        if (!accountId) {
            return res.status(400).json({
                status: false,
                message: "accountId is required",
            });
        }

        const response = await deleteSubMerchant(String(accountId));

        return res.status(200).json({
            status: true,
            message: "Sub-merchant account deleted successfully.",
            data: response,
        });
    } catch (error: any) {
        console.error("Delete Razorpay Account Error:", error?.response?.data || error);

        return res.status(error?.response?.status || 500).json({
            status: false,
            message:
                error?.response?.data?.error?.description ||
                "Failed to delete Razorpay sub-merchant account.",
            error: error?.response?.data || error.message,
        });
    }
};

export const disconnectRazorpay = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const clientId = req.user?.clientId;


        if (!clientId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized.",
            });
        }


        await removeRazorpayConnection(
            clientId
        );


        return res.status(200).json({
            success: true,
            message: "Razorpay disconnected successfully.",
        });


    } catch (error: any) {

        console.error(
            "Disconnect Razorpay Error:",
            error
        );


        return res.status(500).json({
            success: false,
            message: error.message || "Something went wrong.",
        });
    }
};

export const createInvoicePayment = async (
    req: Request,
    res: Response
) => {
    try {
        const {
            invoiceId
        } = req.body;
        if (!invoiceId) {
            throw new Error(
                "Invoice id is required."
            );
        }
        const result =
            await createPayment(invoiceId);
        return res.status(200).json({
            status: true,
            data: result
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

export const verifyPayment = async (
    req: Request,
    res: Response
) => {
    try {
        const {
            transactionId,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
        } = req.body;

        if (
            !transactionId ||
            !razorpayPaymentId ||
            !razorpayOrderId ||
            !razorpaySignature
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment details are required."
            });
        }

        const result =
            await verifyRazorpayPayment({
                transactionId,
                razorpayPaymentId,
                razorpayOrderId,
                razorpaySignature,
            });

        return res.status(200).json({
            status: true,
            message:
                "Payment verified successfully.",
            data: result,
        });


    } catch (error: any) {

        console.error(
            "Verify Payment Error:",
            error
        );


        return res.status(400).json({

            success: false,

            message:
                error.message ||
                "Payment verification failed."

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