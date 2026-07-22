
import bcrypt from "bcryptjs";
import crypto from "crypto"; import { AppDataSource } from "../database/data-source";
import { Client } from "../entities/Client";
import { Role } from "../entities/Role";
import { SubClient } from "../entities/SubClient";
import { User } from "../entities/User";
import { createActivity } from "../utils/helper";
import { ActivityType } from "../utils/constants";

const clientRepository = AppDataSource.getRepository(Client);
const subClientRepository = AppDataSource.getRepository(SubClient);
const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role);

export const createSubClient = async (
    body: any,
    createdByUserId: number
) => {
    const {
        companyName,
        contactPerson,
        email,
        mobile,
        gstNumber,
        panNumber,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        creditLimit,
        availableCredit,
        firstName,
        lastName,
    } = body;

    const createdBy = await userRepository.findOne({
        where: {
            userId: createdByUserId,
        },
        relations: ["client"],
    });

    if (!createdBy) {
        throw new Error("Invalid user.");
    }

    if (!createdBy.client) {
        throw new Error("Client not found.");
    }

    const existingUser = await userRepository.findOne({
        where: [
            { email },
            { mobile },
        ],
    });

    if (existingUser) {
        throw new Error("Email or mobile already exists.");
    }

    const existingSubClient = await subClientRepository.findOne({
        where: [
            { email },
            { mobile },
            { companyName },
        ],
    });

    if (existingSubClient) {
        throw new Error("Sub client already exists.");
    }

    const role = await roleRepository.findOne({
        where: {
            name: "subclient",
        },
    });

    if (!role) {
        throw new Error("Sub Client role not found.");
    }

    const temporaryPassword = crypto
        .randomBytes(6)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 8);

    const hashedPassword = await bcrypt.hash(
        temporaryPassword,
        10
    );

    const subClient = subClientRepository.create({
        companyName,
        contactPerson,
        email,
        mobile,
        gstNumber,
        panNumber,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        creditLimit,
        availableCredit,
        client: createdBy.client,
        createdBy,
    });

    await subClientRepository.save(subClient);

    const user = userRepository.create({
        firstName,
        lastName,
        email,
        mobile,
        password: hashedPassword,
        role,
        client: createdBy.client,
        subClient,
        createdBy,
        isTemporaryPassword: true,
    });

    await userRepository.save(user);

    // Send email with temporaryPassword here
    
    const fullName = `${user.firstName} ${user.lastName}`;
    const clientId = createdBy.client.clientId
    await createActivity(
        `New Dealer "${subClient.companyName}" has been added by ${fullName}.`,
        ActivityType.SUB_CLIENT_CREATED,
        clientId,
        subClient.subClientId,
        user.userId
    )

    return {
        message: "Sub Client created successfully.",
        subClient,
        user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        },
        temporaryPassword, // Remove after email integration
    };
};

export const getSubClients = async (clientId: number) => {
    const subClients = await subClientRepository.find({
        where: {
            client: {
                clientId,
            },
            isActive: true,
        },
        relations: [
            "client",
            "createdBy",
            "users",
        ],
        order: {
            createdAt: "DESC",
        },
    });

    return subClients.map((subClient) => ({
        subClientId: subClient.subClientId,
        companyName: subClient.companyName,
        contactPerson: subClient.contactPerson,
        email: subClient.email,
        mobile: subClient.mobile,
        gstNumber: subClient.gstNumber,
        panNumber: subClient.panNumber,
        website: subClient.website,
        address: subClient.address,
        city: subClient.city,
        state: subClient.state,
        country: subClient.country,
        postalCode: subClient.postalCode,
        creditLimit: subClient.creditLimit,
        availableCredit: subClient.availableCredit,
        createdAt: subClient.createdAt,
        createdBy: subClient.createdBy
            ? {
                userId: subClient.createdBy.userId,
                firstName: subClient.createdBy.firstName,
                lastName: subClient.createdBy.lastName,
            }
            : null,
        subClientAdmin:
            subClient.users.length > 0
                ? {
                    userId: subClient.users[0].userId,
                    firstName: subClient.users[0].firstName,
                    lastName: subClient.users[0].lastName,
                    email: subClient.users[0].email,
                    mobile: subClient.users[0].mobile,
                }
                : null,
    }));
};

export const getSubClientById = async (
    subClientId: number
) => {
    // Fetch sub-client by ID
};

export const updateSubClient = async (
    subClientId: number,
    body: any
) => {
    // Update sub-client
};

export const deleteSubClient = async (
    subClientId: number
) => {
    // Soft delete sub-client
};