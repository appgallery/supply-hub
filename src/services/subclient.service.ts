
import bcrypt from "bcryptjs";
import crypto from "crypto"; import { AppDataSource } from "../database/data-source";
import { Client } from "../entities/Client";
import { Role } from "../entities/Role";
import { SubClient } from "../entities/SubClient";
import { User } from "../entities/User";
import { createActivity } from "../utils/helper";
import { ActivityType, TaxType } from "../utils/constants";
// import { orderRepository } from "./order.service";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { ActivityLog } from "../entities/ActivityLog";


const clientRepository = AppDataSource.getRepository(Client);
const subClientRepository = AppDataSource.getRepository(SubClient);
const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role);
const orderRepository = AppDataSource.getRepository(Order)
const orderItemRepository = AppDataSource.getRepository(OrderItem);
const activityRepository =
    AppDataSource.getRepository(ActivityLog);

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
        taxType,
        taxRate,
        panNumber,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        creditLimit,
        shippingAmount,
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
        taxType,
        taxRate,
        panNumber,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        creditLimit,
        shippingAmount,
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

export const getSubClients = async (
    clientId: number,
    offset: number = 0,
    limit: number = 10,
    subClientId?: number
) => {
    try {
        const whereCondition: any = {
            client: {
                clientId: clientId,
            },
            isActive: true,
        };

        // If a specific subClientId is provided,
        // make sure it belongs to the logged-in client
        if (subClientId !== undefined) {
            whereCondition.subClientId = subClientId;
        }

        const [subClients, total] =
            await subClientRepository.findAndCount({
                where: whereCondition,

                relations: [
                    "client",
                    "createdBy",
                    "users",
                ],

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

            data: subClients.map((subClient) => ({
                subClientId: subClient.subClientId,
                companyName: subClient.companyName,
                contactPerson: subClient.contactPerson,
                email: subClient.email,
                mobile: subClient.mobile,

                gstNumber: subClient.gstNumber,
                taxType: subClient.taxType,
                taxRate: subClient.taxRate,
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
                    subClient.users && subClient.users.length > 0
                        ? {
                            userId: subClient.users[0].userId,
                            firstName: subClient.users[0].firstName,
                            lastName: subClient.users[0].lastName,
                            email: subClient.users[0].email,
                            mobile: subClient.users[0].mobile,
                        }
                        : null,
            })),
        };
    } catch (error) {
        console.error("Get Sub Clients Service Error:", error);
        throw error;
    }
};

export const getSubClientById = async (
    subClientId: number
) => {

    const subClient = await subClientRepository.findOne({
        where: {
            subClientId,
            isActive: true,
        },
        relations: [
            "client",
            "createdBy",
        ],
    });

    if (!subClient) {
        throw new Error("Sub client not found.");
    }

    const user = await userRepository.findOne({
        where: {
            subClient: {
                subClientId,
            },
            isActive: false,
        },
    });

    return {
        ...subClient,
        user: user
            ? {
                userId: user.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobile: user.mobile,
            }
            : null,
    };
};

export const updateSubClient = async (
    subClientId: number,
    body: any
) => {

    const {
        companyName,
        contactPerson,
        email,
        mobile,
        gstNumber,
        taxType,
        taxRate,
        panNumber,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        creditLimit,
        availableCredit,
        shippingAmount,
        owner,
    } = body;

    const subClient = await subClientRepository.findOne({
        where: {
            subClientId,
            isActive: true,
        },
    });

    if (!subClient) {
        throw new Error("Sub client not found.");
    }

    const existingSubClient = await subClientRepository
        .createQueryBuilder("subClient")
        .where(
            "(subClient.email = :email OR subClient.mobile = :mobile OR LOWER(subClient.companyName) = LOWER(:companyName))",
            {
                email,
                mobile,
                companyName,
            }
        )
        .andWhere("subClient.subClientId != :subClientId", {
            subClientId,
        })
        .getOne();

    if (existingSubClient) {
        throw new Error("Company name, email or mobile already exists.");
    }

    subClient.companyName = companyName;
    subClient.contactPerson = contactPerson;
    subClient.email = email;
    subClient.mobile = mobile;
    subClient.gstNumber = gstNumber;
    subClient.taxType = taxType;
    subClient.taxRate = taxRate;
    subClient.panNumber = panNumber;
    subClient.website = website;
    subClient.address = address;
    subClient.city = city;
    subClient.state = state;
    subClient.country = country;
    subClient.postalCode = postalCode;
    subClient.creditLimit = creditLimit;
    subClient.availableCredit = availableCredit;
    subClient.shippingAmount = shippingAmount;

    await subClientRepository.save(subClient);

    const user = await userRepository.findOne({
        where: {
            subClient: {
                subClientId,
            },
            isActive: false,
        },
        relations: ["subClient"],
    });

    if (user && owner) {

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

    await createActivity(
        `Sub Client ${subClient.companyName} has been updated`,
        ActivityType.SUB_CLIENT_UPDATED,
        undefined,
        subClient.subClientId,
        user?.userId
    );

    return {
        message: "Sub client updated successfully.",
        subClient,
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

export const deleteSubClient = async (
    subClientId: number
) => {

    const subClient = await subClientRepository.findOne({
        where: {
            subClientId,
            isActive: true,
        },
    });

    if (!subClient) {
        throw new Error("Sub client not found.");
    }

    subClient.isActive = false;

    await subClientRepository.save(subClient);

    const user = await userRepository.findOne({
        where: {
            subClient: {
                subClientId,
            },
            isActive: false,
        },
        relations: ["subClient"],
    });

    if (user) {
        user.isActive = false;
        await userRepository.save(user);
    }

    await createActivity(
        `Sub Client ${subClient.companyName} has been deleted`,
        ActivityType.SUB_CLIENT_DELETED,
        undefined,
        subClient.subClientId,
        user?.userId
    );

    return {
        message: "Sub client deleted successfully.",
    };
};

export const getDealerDashboard = async (
    dealerId: number,
    month: number,
    year: number
) => {


    const startDate = new Date(year, month - 1, 1);

    const endDate = new Date(
        year,
        month,
        0,
        23,
        59,
        59
    );


    // 1. Order Summary

    const orders = await orderRepository.find({
        where: {
            subClient: {
                subClientId: dealerId
            }
        },
        relations: [
            "items",
            "items.variant",
            "items.variant.product"
        ]
    });


    const orderSummary = {

        totalOrders: orders.length,

        pendingOrders:
            orders.filter(
                o => o.status === "PENDING"
            ).length,

        processingOrders:
            orders.filter(
                o => o.status === "APPROVED"
            ).length,


        completedOrders:
            orders.filter(
                o => o.status === "COMPLETED"
            ).length,


        cancelledOrders:
            orders.filter(
                o => o.status === "REJECTED"
            ).length

    };



    // 2. Revenue Overview Week Wise 

    const daysInMonth = endDate.getDate();

    const weekRanges = [
        { label: "Week 1", start: 1, end: 7 },
        { label: "Week 2", start: 8, end: 14 },
        { label: "Week 3", start: 15, end: 21 },
        { label: "Week 4", start: 22, end: daysInMonth },
    ];

    const revenueOverview = [];

    for (const week of weekRanges) {

        const weekStart = new Date(
            year,
            month - 1,
            week.start,
            0,
            0,
            0,
            0
        );

        const weekEnd = new Date(
            year,
            month - 1,
            week.end,
            23,
            59,
            59,
            999
        );

        const revenue = await orderRepository
            .createQueryBuilder("ord")
            .select(
                "COALESCE(SUM(ord.totalAmount),0)",
                "revenue"
            )
            .where(
                "ord.subClientId = :dealerId",
                { dealerId }
            )
            .andWhere(
                "ord.created_at BETWEEN :startDate AND :endDate",
                {
                    startDate: weekStart,
                    endDate: weekEnd,
                }
            )
            .getRawOne();

        revenueOverview.push({
            week: week.label,
            revenue: Number(revenue.revenue),
        });
    }

    // Current Month Revenue
    const currentRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where("order.subClientId = :dealerId", { dealerId })
        .andWhere("order.created_at BETWEEN :start AND :end", {
            start: startDate,
            end: endDate,
        })
        .getRawOne();

    // Previous Month
    const previousMonthDate = new Date(year, month - 2, 1);

    const startLastMonth = new Date(
        previousMonthDate.getFullYear(),
        previousMonthDate.getMonth(),
        1,
        0,
        0,
        0
    );

    const endLastMonth = new Date(
        previousMonthDate.getFullYear(),
        previousMonthDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
    );

    const lastMonthRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where("order.subClientId = :dealerId", { dealerId })
        .andWhere("order.created_at BETWEEN :start AND :end", {
            start: startLastMonth,
            end: endLastMonth,
        })
        .getRawOne();

    const calculatePercentage = (
        current: number,
        previous: number
    ) => {
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }

        return Number(
            (((current - previous) / previous) * 100).toFixed(2)
        );
    };

    // 3. Order Status based on selected month
    const orderStatusOverview =
        await orderRepository
            .createQueryBuilder("order")
            .select(
                "order.status",
                "status"
            )
            .addSelect(
                "COUNT(order.orderId)",
                "count"
            )
            .where(
                "order.subClientId = :dealerId",
                {
                    dealerId
                }
            )
            .andWhere(
                "order.created_at BETWEEN :startDate AND :endDate",
                {
                    startDate,
                    endDate
                }
            )
            .groupBy(
                "order.status"
            )
            .getRawMany();

    // 4. Important Updates

    const activityFeed =
        await activityRepository.find({
            where: {
                subClientId: dealerId
            },
            order: {
                created_at: "DESC"
            },
            take: 5
        });

    // 5. Recent Orders
    const recentOrders =
        await orderRepository.find({
            where: {
                subClient: {
                    subClientId: dealerId
                }
            },
            order: {
                created_at: "DESC"
            },
            take: 5,
            relations: [
                "items",
                "items.variant",
                "items.variant.product"
            ]
        });

    // 6. Top Purchased Products

    const topProducts =
        await orderItemRepository
            .createQueryBuilder("item")
            .leftJoin(
                "item.order",
                "order"
            )
            .leftJoin(
                "item.variant",
                "variant"
            )
            .leftJoin(
                "variant.product",
                "product"
            )
            .select(
                "product.productId",
                "productId"
            )
            .addSelect(
                "product.productName",
                "productName"
            )
            .addSelect(
                "SUM(item.quantity)",
                "totalQuantity"
            )
            .addSelect(
                "SUM(item.quantity * item.price)",
                "totalSpent"
            )
            .where(
                "order.subClientId = :dealerId",
                {
                    dealerId
                }
            )
            .andWhere(
                "order.created_at BETWEEN :startDate AND :endDate",
                {
                    startDate,
                    endDate
                }
            )
            .groupBy(
                "product.productId"
            )
            .addGroupBy(
                "product.productName"
            )
            .orderBy(
                '"totalSpent"',
                "DESC"
            )
            .limit(5)
            .getRawMany();



    return {
        orderSummary,
        revenueDetails: {
            thisMonth: Number(currentRevenue.revenue),
            lastMonth: Number(lastMonthRevenue.revenue),
            percentage: calculatePercentage(
                Number(currentRevenue.revenue),
                Number(lastMonthRevenue.revenue)
            ),
        },
        revenueOverview,
        orderStatusOverview,
        activityFeed,
        recentOrders,
        topProducts
    };

};