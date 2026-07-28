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
        businessType,
        registrationNumber,
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
        businessType,
        registrationNumber,
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
        relations: [
            "users",
            "createdBy",
            "subClients",
            "products",
            "owners"
        ],
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
            businessType: client.businessType,
            registrationNumber: client.registrationNumber,
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

            totalDealers: client.subClients?.length || 0,
            totalProducts: client.products?.length || 0,

            createdAt: client.createdAt,

            createdBy: client.createdBy
                ? {
                    userId: client.createdBy.userId,
                    firstName: client.createdBy.firstName,
                    lastName: client.createdBy.lastName,
                }
                : null,

            clientAdmin:
                client.owners.length > 0
                    ? {
                        clientOwnerId: client.owners[0].clientOwnerId,
                        firstName: client.owners[0].firstName,
                        lastName: client.owners[0].lastName,
                        email: client.owners[0].email,
                        mobile: client.owners[0].mobile,
                        designation: client.owners[0].designation,
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

    const {
        companyName,
        contactPerson,
        businessType,
        registrationNumber,
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
        owner,
    } = body;

    const client = await clientRepository.findOne({
        where: {
            clientId,
        },
        relations: [
            "createdBy",
        ],
    });

    if (!client) {
        throw new Error("Client not found.");
    }

    // Check duplicate company name
    if (companyName) {

        const existingCompany = await clientRepository
            .createQueryBuilder("client")
            .where("LOWER(client.companyName) = LOWER(:companyName)", {
                companyName,
            })
            .andWhere("client.clientId != :clientId", {
                clientId,
            })
            .getOne();

        if (existingCompany) {
            throw new Error("Company name already exists.");
        }
    }

    // Check duplicate email/mobile
    const existingClient = await clientRepository
        .createQueryBuilder("client")
        .where(
            "(client.email = :email OR client.mobile = :mobile)",
            {
                email,
                mobile,
            }
        )
        .andWhere("client.clientId != :clientId", {
            clientId,
        })
        .getOne();

    if (existingClient) {
        throw new Error("Email or mobile already exists.");
    }

    // Update Client
    client.companyName = companyName;
    client.businessType = businessType;
    client.registrationNumber = registrationNumber;
    client.contactPerson = contactPerson;
    client.email = email;
    client.mobile = mobile;
    client.gstNumber = gstNumber;
    client.panNumber = panNumber;
    client.website = website;
    client.address = address;
    client.city = city;
    client.state = state;
    client.country = country;
    client.postalCode = postalCode;
    client.creditLimit = creditLimit;
    client.availableCredit = availableCredit;

    await clientRepository.save(client);

    // Update Owner
    let clientOwner = await clientOwnerRepository.findOne({
        where: {
            client: {
                clientId,
            },
        },
        relations: [
            "client",
        ],
    });

    if (owner) {

        if (clientOwner) {

            clientOwner.firstName = owner.firstName;
            clientOwner.lastName = owner.lastName;
            clientOwner.email = owner.email;
            clientOwner.mobile = owner.mobile;
            clientOwner.designation = owner.designation;
            clientOwner.panNumber = owner.panNumber;
            clientOwner.aadhaarNumber = owner.aadhaarNumber;
            clientOwner.dob = owner.dob;

            await clientOwnerRepository.save(clientOwner);

        } else {

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
    }

    // Update Login User
    const user = await userRepository.findOne({
        where: {
            client: {
                clientId,
            },
        },
        relations: [
            "client",
        ],
    });

    if (user && owner) {

        // Check duplicate owner email/mobile
        const existingUser = await userRepository
            .createQueryBuilder("user")
            .where(
                "(user.email = :email OR user.mobile = :mobile)",
                {
                    email: owner.email,
                    mobile: owner.mobile,
                }
            )
            .andWhere("user.userId != :userId", {
                userId: user.userId,
            })
            .getOne();

        if (existingUser) {
            throw new Error("Owner email or mobile already exists.");
        }

        user.firstName = owner.firstName;
        user.lastName = owner.lastName;
        user.email = owner.email;
        user.mobile = owner.mobile;

        await userRepository.save(user);
    }

    // Activity
    await createActivity(
        `Client ${client.companyName} has been updated`,
        ActivityType.CLIENT_UPDATED,
        client.clientId,
        undefined,
        user?.userId
    );

    return {
        message: "Client updated successfully.",
        client,
        owner: clientOwner,
        user: user
            ? {
                userId: user.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            }
            : null,
    };
};

export const deleteClient = async (
    clientId: number
) => {

    const client = await clientRepository.findOne({
        where: {
            clientId,
            isActive: true,
        },
    });

    if (!client) {
        throw new Error("Client not found.");
    }

    // Soft delete client
    client.isActive = false;

    await clientRepository.save(client);

    // Soft delete owner
    const clientOwner = await clientOwnerRepository.findOne({
        where: {
            client: {
                clientId,
            },
            isActive: false,
        },
        relations: ["client"],
    });

    if (clientOwner) {
        clientOwner.isActive = true;
        await clientOwnerRepository.save(clientOwner);
    }

    // Soft delete login user
    const user = await userRepository.findOne({
        where: {
            client: {
                clientId,
            },
            isActive: false,
        },
        relations: ["client"],
    });

    if (user) {
        user.isActive = false;
        await userRepository.save(user);
    }

    // Activity
    await createActivity(
        `Client ${client.companyName} has been deleted`,
        ActivityType.CLIENT_DELETED,
        client.clientId,
        undefined,
        user?.userId
    );

    return {
        message: "Client deleted successfully.",
    };
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