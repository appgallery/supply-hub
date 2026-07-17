import { Request, Response } from "express";
import * as RoleService from "../services/role.service";

export const createRole = async (
    req: Request,
    res: Response
) => {
    try {
        const data = await RoleService.createRole(
            req.body,        );

        return res.status(201).json({
            success: true,
            message: "Role created successfully",
            data,
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const getRoles = async (
    req: Request,
    res: Response
) => {
    try {
        const data = await RoleService.getRoles();

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const getRoleById = async (
    req: Request,
    res: Response
) => {
    try {
        const data = await RoleService.getRoleById(
            Number(req.params.roleId)
        );

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error: any) {
        return res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateRole = async (
    req: Request,
    res: Response
) => {
    try {
        const data = await RoleService.updateRole(
            Number(req.params.roleId),
            req.body        );

        return res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data,
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const deleteRole = async (
    req: Request,
    res: Response
) => {
    try {
        const data = await RoleService.deleteRole(
            Number(req.params.roleId)
        );

        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};