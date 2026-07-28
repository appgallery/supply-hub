import { Request, Response, NextFunction } from "express";
import * as paymentService from "../services/transaction.service";

// export const checkout = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ) => {
//     try {
//         const userId = (req as any).user.userId;

//         const response = await paymentService.checkout(
//             req.body,
//             userId
//         );

//         return res.status(200).json({
//             status: true,
//             message: "Checkout created successfully.",
//             data: response,
//         });

//     } catch (error) {
//         next(error);
//     }
// };