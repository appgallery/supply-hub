import { Between, Like } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Client } from "../entities/Client";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { SubClient } from "../entities/SubClient";
import { User } from "../entities/User";
import { Variant } from "../entities/Variants";
import { ActivityType, OrderStatus } from "../utils/constants";
import { Product } from "../entities/Product";
import { ActivityLog } from "../entities/ActivityLog";
import { createActivity } from "../utils/helper";

export const orderRepository = AppDataSource.getRepository(Order);
export const orderItemRepository = AppDataSource.getRepository(OrderItem);
export const variantRepository = AppDataSource.getRepository(Variant);
export const subClientRepository = AppDataSource.getRepository(SubClient);
export const userRepository = AppDataSource.getRepository(User);
export const clientRepository = AppDataSource.getRepository(Client);
export const productRepository = AppDataSource.getRepository(Product);
export const activityLogRepository = AppDataSource.getRepository(ActivityLog);

export const createOrder = async (
    body: any,
    userId: number
) => {

    const { notes, items } = body;

    // validation
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("Order items are required.");
    }

    const variantIds = items.map((item: any) => item.variantId);

    if (new Set(variantIds).size !== variantIds.length) {
        throw new Error("Duplicate variants are not allowed in an order.");
    }

    // find logged-in user
    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "subClient",
            "subClient.client",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    // verify sub client
    if (!user.subClient) {
        throw new Error("Only sub client can place an order.");
    }

    const subClient = user.subClient;

    const client = user.subClient.client;

    if (!client) {
        throw new Error("Client not found.");
    }

    // calculate total
    let subtotal = 0;
    let totalDiscount = 0;
    let grandTotal = 0;

    const orderItems: OrderItem[] = [];

    const variantUpdates: {
        variant: Variant;
        quantity: number;
    }[] = [];

    for (const item of items) {

        if (!item.variantId) {
            throw new Error("Variant is required.");
        }

        if (!item.quantity || item.quantity <= 0) {
            throw new Error("Quantity should be greater than zero.");
        }

        const variant = await variantRepository.findOne({
            where: {
                variantId: item.variantId,
                is_active: true,
            },
            relations: [
                "product",
            ],
        });

        if (!variant) {
            throw new Error(`Variant ${item.variantId} not found.`);
        }

        if (variant.stock < item.quantity) {
            throw new Error(
                `${variant.name} has only ${variant.stock} items available.`
            );
        }

        const price = Number(variant.price);

        const discount =
            (price * Number(variant.discount_percentage)) / 100;

        const finalPrice = price - discount;

        const total = finalPrice * item.quantity;

        subtotal += price * item.quantity;

        totalDiscount += discount * item.quantity;

        grandTotal += total;

        const orderItem = orderItemRepository.create({
            variant,
            quantity: item.quantity,
            price,
            discount,
            total,
        });

        orderItems.push(orderItem);

        variantUpdates.push({
            variant,
            quantity: item.quantity,
        });
    }

    const order = orderRepository.create({
        client,
        subClient,
        notes,
        subtotal,
        totalDiscount,
        totalAmount: grandTotal,
        created_by: user.userId
    });

    const savedOrder = await orderRepository.save(order);

    savedOrder.orderNumber = `ORD${savedOrder.orderId
        .toString()
        .padStart(6, "0")}`;

    await orderRepository.save(savedOrder);

    const fullName = `${user.firstName} ${user.lastName}`;
    await createActivity(
        `Order "${savedOrder.orderNumber}" has been placed by Dealer "${subClient.companyName}" (${fullName}).`,
        ActivityType.ORDER_CREATED,
        client.clientId,
        subClient.subClientId,
        user.userId
    );

    for (const item of orderItems) {
        item.order = savedOrder;
    }
    await orderItemRepository.save(orderItems);

    for (const item of variantUpdates) {
        item.variant.stock -= item.quantity;

        await variantRepository.save(item.variant);
    }

    const orderDetails = await orderRepository.findOne({
        where: {
            orderId: savedOrder.orderId,
        },
        relations: [
            "client",
            "subClient",
            "items",
            "items.variant",
            "items.variant.product",
            "items.variant.color",
            "items.variant.size",
        ]
    });

    return orderDetails;
};

export const getOrders = async (query: any, userId: number) => {
    const {
        offset = 0,
        limit = 10,
        search,
        status,
        subClientId,
    } = query;

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "client",
            "subClient",
            "subClient.client",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const where: any = {};

    if (user.client) {
        where.client = {
            clientId: user.client.clientId,
        };
    }

    if (user.subClient) {
        where.subClient = {
            subClientId: user.subClient.subClientId,
        };
    }

    if (search) {
        where.orderNumber = Like(`%${search}%`);
    }

    if (status) {
        where.status = status;
    }

    if (subClientId && user.client) {
        where.subClient = {
            subClientId: Number(subClientId),
        };
    }

    const [orders, total] = await orderRepository.findAndCount({
        where,
        relations: [
            "client",
            "subClient",
            "items",
            "items.variant",
            "items.variant.product",
            "items.variant.color",
            "items.variant.size",
        ],
        order: {
            created_at: "DESC",
        },
        skip: Number(offset),
        take: Number(limit),
    });

    return {
        total,
        offset: Number(offset),
        limit: Number(limit),
        count: orders.length,
        orders,
    };
};

export const getOrderById = async (
    orderId: number,
    userId: number
) => {

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "client",
            "subClient",
            "subClient.client",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const where: any = {
        orderId,
    };

    if (user.client) {
        where.client = {
            clientId: user.client.clientId,
        };
    }

    if (user.subClient) {
        where.subClient = {
            subClientId: user.subClient.subClientId,
        };
    }

    const order = await orderRepository.findOne({
        where,
        relations: [
            "client",
            "subClient",
            "items",
            "items.variant",
            "items.variant.product",
            "items.variant.color",
            "items.variant.size",
        ],
    });

    if (!order) {
        throw new Error("Order not found.");
    }

    return order;
};

export const deleteOrder = async (
    orderId: number,
    userId: number
) => {

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "client",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (!user.client) {
        throw new Error("Only client can delete an order.");
    }

    const order = await orderRepository.findOne({
        where: {
            orderId,
            client: {
                clientId: user.client.clientId,
            },
        },
        relations: [
            "items",
            "items.variant",
        ],
    });

    if (!order) {
        throw new Error("Order not found.");
    }

    // Restore stock
    for (const item of order.items) {

        item.variant.stock += item.quantity;

        await variantRepository.save(item.variant);
    }

    await orderRepository.remove(order);

    return;
};

export const updateOrder = async (
    orderId: number,
    body: any,
    userId: number
) => {

    const { notes } = body;

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "client",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (!user.client) {
        throw new Error("Only client can update an order.");
    }

    const order = await orderRepository.findOne({
        where: {
            orderId,
            client: {
                clientId: user.client.clientId,
            },
        },
    });

    if (!order) {
        throw new Error("Order not found.");
    }

    if (order.status !== OrderStatus.PENDING) {
        throw new Error("Only pending orders can be updated.");
    }

    order.notes = notes ?? order.notes;
    order.updated_by = user.userId;

    await orderRepository.save(order);

    return order;
};

export const getClientDashboard = async (
    userId: number
) => {

    // Find logged-in user
    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "client",
            "role",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (user.role.name.toLowerCase() !== "client") {
        throw new Error("Only client can access this dashboard.");
    }

    const now = new Date();

    const startCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );

    const startLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
    );

    const endLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0
    );

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

    const currentProducts = await productRepository.count({
        where: {
            category: {
                client: {
                    clientId: user.client.clientId,
                },
            },
            created_at: Between(startCurrentMonth, now),
        },
    });

    const lastMonthProducts = await productRepository.count({
        where: {
            category: {
                client: {
                    clientId: user.client.clientId,
                },
            },
            created_at: Between(startLastMonth, endLastMonth),
        },
    });

    const currentOrders = await orderRepository.count({
        where: {
            client: {
                clientId: user.client.clientId,
            },
            created_at: Between(startCurrentMonth, now),
        },
    });

    const lastMonthOrders = await orderRepository.count({
        where: {
            client: {
                clientId: user.client.clientId,
            },
            created_at: Between(startLastMonth, endLastMonth),
        },
    });

    const currentDealers = await subClientRepository.count({
        where: {
            client: {
                clientId: user.client.clientId,
            },
            createdAt: Between(startCurrentMonth, now),
        },
    });

    const lastMonthDealers = await subClientRepository.count({
        where: {
            client: {
                clientId: user.client.clientId,
            },
            createdAt: Between(startLastMonth, endLastMonth),
        },
    });

    const currentRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where("order.clientId = :clientId", {
            clientId: user.client.clientId,
        })
        .andWhere("order.created_at BETWEEN :start AND :end", {
            start: startCurrentMonth,
            end: now,
        })
        .getRawOne();

    const lastMonthRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where("order.clientId = :clientId", {
            clientId: user.client.clientId,
        })
        .andWhere("order.created_at BETWEEN :start AND :end", {
            start: startLastMonth,
            end: endLastMonth,
        })
        .getRawOne();
    const totalClients = await clientRepository.count();

    const totalDealers = await subClientRepository.count();

    const totalProducts = await productRepository.count({
        where: {
            category: {
                client: {
                    clientId: user.client.clientId,
                },
            },
        },
    });

    const totalOrders = await orderRepository.count({
        where: {
            client: {
                clientId: user.client.clientId,
            },
        },
    });

    const revenue = await orderRepository
        .createQueryBuilder("order")
        .select("SUM(order.totalAmount)", "revenue")
        .where("order.clientId = :clientId", {
            clientId: user.client.clientId,
        })
        .getRawOne();

    const topClients = await orderRepository
        .createQueryBuilder("order")
        .leftJoin("order.subClient", "subClient")
        .select("subClient.companyName", "companyName")
        .addSelect("SUM(order.totalAmount)", "revenue")
        .groupBy("subClient.subClientId")
        .orderBy("SUM(order.totalAmount)", "DESC")
        .limit(10)
        .getRawMany();

    const recentOrders = await orderRepository.find({
        where: {
            client: {
                clientId: user.client.clientId,
            },
        },
        relations: [
            "subClient",
        ],
        order: {
            created_at: "DESC",
        },
        take: 10,
    });

    const recentClients = await subClientRepository.find({
        where: {
            client: {
                clientId: user.client.clientId,
            },
        },
        order: {
            createdAt: "DESC",
        },
        take: 10,
    });

    const activityFeed = await activityLogRepository.find({
        where: {
            clientId: user.client.clientId,
        },
        order: {
            created_at: "DESC",
        },
        take: 10,
    });

    return {
        cards: {
            totalClients: {
                total: totalClients,
            },

            totalDealers: {
                total: totalDealers,
                thisMonth: currentDealers,
                lastMonth: lastMonthDealers,
                percentage: calculatePercentage(
                    currentDealers,
                    lastMonthDealers
                ),
            },

            totalProducts: {
                total: totalProducts,
                thisMonth: currentProducts,
                lastMonth: lastMonthProducts,
                percentage: calculatePercentage(
                    currentProducts,
                    lastMonthProducts
                ),
            },

            totalOrders: {
                total: totalOrders,
                thisMonth: currentOrders,
                lastMonth: lastMonthOrders,
                percentage: calculatePercentage(
                    currentOrders,
                    lastMonthOrders
                ),
            },

            totalRevenue: {
                total: Number(revenue.revenue ?? 0),
                thisMonth: Number(currentRevenue.revenue),
                lastMonth: Number(lastMonthRevenue.revenue),
                percentage: calculatePercentage(
                    Number(currentRevenue.revenue),
                    Number(lastMonthRevenue.revenue)
                ),
            },
        },
        revenueOverview: [],
        topClients,
        recentClients,
        recentOrders,
        activityFeed,
    };
};

export const getAdminDashboard = async (
    userId: number
) => {

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "role",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (user.role.name.toLowerCase() !== "admin") {
        throw new Error("Only admin can access this dashboard.");
    }
    const now = new Date();

    const startCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );

    const startLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
    );

    const endLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0
    );

    const calculatePercentage = (
        current: number,
        previous: number
    ) => {

        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }

        return Number(
            (((current - previous) / previous) * 100)
                .toFixed(2)
        );
    };

    // Cards
    const totalClients = await clientRepository.count();

    const totalDealers = await subClientRepository.count();

    const totalProducts = await productRepository.count();

    const totalOrders = await orderRepository.count();

    const currentClients = await clientRepository.count({
        where: {
            createdAt: Between(
                startCurrentMonth,
                now
            )
        }
    });

    const lastMonthClients = await clientRepository.count({
        where: {
            createdAt: Between(
                startLastMonth,
                endLastMonth
            )
        }
    });

    const currentProducts = await productRepository.count({
        where: {
            created_at: Between(
                startCurrentMonth,
                now
            )
        }
    });

    const lastMonthProducts = await productRepository.count({
        where: {
            created_at: Between(
                startLastMonth,
                endLastMonth
            )
        }
    });

    const currentOrders = await orderRepository.count({
        where: {
            created_at: Between(
                startCurrentMonth,
                now
            )
        }
    });

    const lastMonthOrders = await orderRepository.count({
        where: {
            created_at: Between(
                startLastMonth,
                endLastMonth
            )
        }

    });
    // Revenue
    const revenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .getRawOne();

    // Top Clients by Revenue
    const topClients = await orderRepository
        .createQueryBuilder("order")
        .leftJoin("order.client", "client")
        .select("client.clientId", "clientId")
        .addSelect("client.companyName", "companyName")
        .addSelect("SUM(order.totalAmount)", "revenue")
        .groupBy("client.clientId")
        .addGroupBy("client.companyName")
        .orderBy("SUM(order.totalAmount)", "DESC")
        .limit(10)
        .getRawMany();

    // Recent Clients
    const recentClients = await clientRepository.find({
        order: {
            createdAt: "DESC",
        },
        take: 10,
    });

    // Recent Orders
    const recentOrders = await orderRepository.find({
        relations: [
            "client",
            "subClient",
        ],
        order: {
            created_at: "DESC",
        },
        take: 10,
    });

    // Activity Feed
    const activityFeed = await activityLogRepository.find({
        order: {
            created_at: "DESC",
        },
        take: 10,
    });

    return {
        cards: {
            totalClients: {
                total: totalClients,
                thisMonth: currentClients,
                lastMonth: lastMonthClients,
                percentage: calculatePercentage(
                    currentClients,
                    lastMonthClients
                ),
            },

            totalDealers: {
                total: totalDealers,
                // Add dealer month comparison if required
            },

            totalProducts: {
                total: totalProducts,
                thisMonth: currentProducts,
                lastMonth: lastMonthProducts,
                percentage: calculatePercentage(
                    currentProducts,
                    lastMonthProducts
                ),
            },

            totalOrders: {
                total: totalOrders,
                thisMonth: currentOrders,
                lastMonth: lastMonthOrders,
                percentage: calculatePercentage(
                    currentOrders,
                    lastMonthOrders
                ),
            },

            totalRevenue: Number(revenue.revenue),
        },

        revenueOverview: [],
        topClients,
        recentClients,
        recentOrders,
        activityFeed,
    };
};