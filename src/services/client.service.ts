import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppDataSource } from "../database/data-source";
import { Client } from "../entities/Client";
import { User } from "../entities/User";
import { Role } from "../entities/Role";
const clientRepository = AppDataSource.getRepository(Client);
const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role);

export const createClient = async (body: any, createdByUserId: number) => {
    const {
        companyName,
        clientCode,
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
        relations: ["role"],
    });

    if (!createdBy) {
        throw new Error("Invalid user.");
    }


    if (createdBy.role.name !== "admin") {
        throw new Error("Only Admin can create clients.");
    }

    if (!companyName) {
        throw new Error("Company name is required.");
    }

    if (!email) {
        throw new Error("Email is required.");
    }

    const existingUser = await userRepository.findOne({
        where: [{ email }, { mobile }],
    });

    if (existingUser) {
        throw new Error("Email or mobile already exists.");
    }

    const existingClient = await clientRepository.findOne({
        where: [{ clientCode }, { companyName }],
    });

    if (existingClient) {
        throw new Error("Client already exists.");
    }

    const role = await roleRepository.findOne({
        where: {
            name: "client",
        },
    });

    if (!role) {
        throw new Error("Client role not found.");
    }

    // Generate temporary password
    const temporaryPassword = crypto
        .randomBytes(6)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8);

    const hashedPassword = await bcrypt.hash(
        temporaryPassword,
        10
    );

    const client = clientRepository.create({
        companyName,
        clientCode,
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
        createdBy
    });

    await clientRepository.save(client);

    const user = userRepository.create({
        firstName,
        lastName,
        email,
        mobile,
        password: hashedPassword,
        role,
        client,
        isTemporaryPassword: true, // Add this column in User entity
        createdBy
    });

    await userRepository.save(user);

    // Send credentials via email
    /*
    await sendWelcomeEmail({
        to: email,
        firstName,
        password: temporaryPassword,
    });
    */

    return {
        message: "Client created successfully.",
        client,
        user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        },
        temporaryPassword, // Remove this in production after email integration
    };
};
export const getClients = async () => {
    const clients = await clientRepository.find({
        relations: ["users", "createdBy"],
        where: {
            isActive: true,
        },
        order: {
            createdAt: "DESC",
        },
    });

    return clients.map((client) => ({
        clientId: client.clientId,
        clientCode: client.clientCode,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        email: client.email,
        mobile: client.mobile,
        gstNumber: client.gstNumber,
        panNumber: client.panNumber,
        website: client.website,
        address: client.address,
        city: client.city,
        state: client.state,
        country: client.country,
        postalCode: client.postalCode,
        creditLimit: client.creditLimit,
        availableCredit: client.availableCredit,
        createdAt: client.createdAt,
        createdBy: client.createdBy
            ? {
                userId: client.createdBy.userId,
                firstName: client.createdBy.firstName,
                lastName: client.createdBy.lastName,
            }
            : null,
        clientAdmin:
            client.users.length > 0
                ? {
                    userId: client.users[0].userId,
                    firstName: client.users[0].firstName,
                    lastName: client.users[0].lastName,
                    email: client.users[0].email,
                    mobile: client.users[0].mobile,
                }
                : null,
    }));
};

export const getClientById = async (clientId: number) => {
    // Fetch client by ID
};

export const updateClient = async (
    clientId: number,
    body: any
) => {
    // Update client details
};

export const deleteClient = async (clientId: number) => {
    // Soft delete client
};