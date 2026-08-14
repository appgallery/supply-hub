import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { getInvoices } from "../services/invoice.service";

export const getInvoicesController = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const invoiceId = req.query.invoiceId
            ? Number(req.query.invoiceId)
            : undefined;

        const userId = req.user.userId;
        const roleName = req.user.roleName;

        const data = await getInvoices(
            invoiceId,
            userId,
            roleName
        );

        return res.status(200).json({
            success: true,
            message: "Invoice fetched successfully.",
            data,
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};