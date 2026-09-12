import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { getInvoices } from "../services/invoice.service";

export const getInvoicesController = async (
    req: AuthRequest,
    res: Response
) => {

    try {

        const {
            invoiceId,
            paymentStatus,
            orderStatus,
            offset,
            limit,
            searchTerm
        } = req.query;


        const result = await getInvoices(
            invoiceId ? Number(invoiceId) : undefined,
            req.user!.userId,
            req.user!.roleName,
            {
                paymentStatus: paymentStatus as string,
                orderStatus: orderStatus as string,
                offset: Number(offset) || 0,
                limit: Number(limit) || 10,
                searchTerm: searchTerm as string
            }
        );


        return res.status(200).json({
            status:true,
            message:"Invoices fetched successfully.",
            ...result
        });


    } catch(error:any){

        return res.status(500).json({
            status:false,
            message:error.message
        });

    }
};