import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await authService.login(req.body);

        return res.status(200).json({
            status:true,
            message:"Login successfully...",
            ...result
            
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};

export const logout = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const result = await authService.logout();

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            status: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const data = await authService.forgotPassword(req.body);

        return res.status(200).json({
            status: true,
            ...data,
        });
    } catch (error: any) {
        return res.status(400).json({
            status: false,
            message: error.message,
        });
    }
};

export const verifyResetOtpController = async (req: Request, res: Response) => {
    try {
        const data = await authService.verifyResetOtp(req.body);

        return res.status(200).json({
            status: true,
            message:"Otp verified.",
            ...data,
        });
    } catch (error: any) {
        return res.status(400).json({
            status: false,
            message: error.message,
        });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const data = await authService.resetPassword(req.body);

        return res.status(200).json({
            status: true,
            message:"Password reset successfully...",
            ...data,
        });
    } catch (error: any) {
        return res.status(400).json({
            status: false,
            message: error.message,
        });
    }
};
