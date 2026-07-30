import { Request, Response } from "express";
import * as addressService from "../services/address.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { AddressType } from "../utils/constants";

export const createAddress = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await addressService.createAddress(
            req.body,
            req.user.userId,
            req.user.roleName
        );

        return res.status(201).json({
            status: true,
            message: "Address created successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getAddresses = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await addressService.getAddresses(
            req.user.userId,
            req.user.roleName,
            req.query.addressType as AddressType
        );

        return res.status(200).json({
            status: true,
            message: "Addresses fetched successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const getAddressById = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await addressService.getAddressById(
            Number(req.query.addressId),
            req.user.userId,
            req.user.roleName
        );

        return res.status(200).json({
            status: true,
            message: "Address fetched successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const updateAddress = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await addressService.updateAddress(
            Number(req.query.addressId),
            req.body,
            req.user.userId,
            req.user.roleName
        );

        return res.status(200).json({
            status: true,
            message: "Address updated successfully.",
            data: result,
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const deleteAddress = async (
    req: AuthRequest,
    res: Response
) => {
    try {

        const result = await addressService.deleteAddress(
            Number(req.query.addressId),
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
