import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppDataSource } from "../database/data-source";
import { Client } from "../entities/Client";
import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { createActivity } from "../utils/helper";
import { ActivityType } from "../utils/constants";
import { ClientOwner } from "../entities/ClientOwner";
const clientRepository = AppDataSource.getRepository(Client);
const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role);
const clientOwnerRepository = AppDataSource.getRepository(ClientOwner)

export const createClient = async (
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
        owner,
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

    const clientCode = await generateClientCode();


    const existingUser = await userRepository.findOne({
        where: [
            { email },
            { mobile },
        ],
    });

    if (existingUser) {
        throw new Error("Email or mobile already exists.");
    }

    const existingClient = await clientRepository.findOne({
        where: [
            { companyName },
            { clientCode },
        ],
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

    // Temporary password
    const temporaryPassword = crypto
        .randomBytes(6)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8);

    const hashedPassword = await bcrypt.hash(
        temporaryPassword,
        10
    );

    // Create Client
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
        createdBy,
    });

    await clientRepository.save(client);

    // Create Login User
    const user = userRepository.create({
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        mobile: owner.mobile,
        password: hashedPassword,
        role,
        client,
        createdBy,
        isTemporaryPassword: true,
    });

    await userRepository.save(user);

    // Create Owner
    let clientOwner = null;

    if (owner) {

        clientOwner = clientOwnerRepository.create({
            client,

            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            mobile: owner.mobile,
            designation: owner.designation,
            panNumber: owner.panNumber,
            aadhaarNumber: owner.aadhaarNumber,
            dob: owner.dob,
        });

        await clientOwnerRepository.save(clientOwner);
    }

    // Activity
    await createActivity(
        `New Client ${client.companyName} has been added`,
        ActivityType.CLIENT_CREATED,
        client.clientId,
        undefined,
        user.userId
    );

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

        owner: clientOwner,

        user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        },

        temporaryPassword,
    };
};
export const getClients = async (
    offset: number = 0,
    limit: number = 10
) => {

    const [clients, total] = await clientRepository.findAndCount({
        relations: ["users", "createdBy"],
        where: {
            isActive: true,
        },
        order: {
            createdAt: "DESC",
        },
        skip: offset,
        take: limit,
    });

    return {
        total,
        offset,
        limit,
        data: clients.map((client) => ({
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
        })),
    };
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

export const generateClientCode = async () => {
    const lastClient = await clientRepository.find({
        order: {
            clientId: "DESC", // or createdAt if that's your ordering field
        },
        take: 1,
    });

    if (!lastClient.length) {
        return "CLI000001";
    }

    const lastNumber = Number(
        lastClient[0].clientCode.replace("CLI", "")
    );

    return `CLI${String(lastNumber + 1).padStart(6, "0")}`;
};