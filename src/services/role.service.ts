import { AppDataSource } from "../database/data-source";
import { Role } from "../entities/Role";

const roleRepository = AppDataSource.getRepository(Role);

export const createRole = async (body: any) => {
    const existingRole = await roleRepository.findOne({
        where: {
            name: body.name,
        },
    });

    if (existingRole) {
        throw new Error("Role already exists");
    }

    const role = roleRepository.create({
        name: body.name,
        description: body.description,
    });

    return await roleRepository.save(role);
};

export const getRoles = async () => {
    return await roleRepository.find({
        order: {
            roleId: "DESC",
        },
    });
};

export const getRoleById = async (roleId: number) => {
    const role = await roleRepository.findOne({
        where: {
            roleId,
        }
    });

    if (!role) {
        throw new Error("Role not found");
    }

    return role;
};

export const updateRole = async (
    roleId: number,
    body: any,
) => {
    const role = await roleRepository.findOne({
        where: {
            roleId,
        },
    });

    if (!role) {
        throw new Error("Role not found");
    }

    if (body.name && body.name !== role.name) {
        const existingRole = await roleRepository.findOne({
            where: {
                name: body.name,
            },
        });

        if (existingRole) {
            throw new Error("Role already exists");
        }
    }

    role.name = body.name ?? role.name;
    role.description = body.description ?? role.description;

    return await roleRepository.save(role);
};

export const deleteRole = async (roleId: number) => {
    const role = await roleRepository.findOne({
        where: {
            roleId,
        },
    });

    if (!role) {
        throw new Error("Role not found");
    }

    await roleRepository.softRemove(role);

    return {
        message: "Role deleted successfully",
    };
};