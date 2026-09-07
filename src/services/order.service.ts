import { Between, Like } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Client } from "../entities/Client";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { SubClient } from "../entities/SubClient";
import { User } from "../entities/User";
import { Variant } from "../entities/Variants";
import { ActivityType, AddressType, InvoiceStatus, OrderStatus } from "../utils/constants";
import { Product } from "../entities/Product";
import { ActivityLog } from "../entities/ActivityLog";
import { createActivity } from "../utils/helper";
import { Cart } from "../entities/Cart";
import { Address } from "../entities/Address";
import { CartItem } from "../entities/CartItem";
import { sendPushNotification } from "./notification.service";
import { Invoice } from "../entities/Invoice";

export const orderRepository = AppDataSource.getRepository(Order);
export const orderItemRepository = AppDataSource.getRepository(OrderItem);
export const variantRepository = AppDataSource.getRepository(Variant);
export const subClientRepository = AppDataSource.getRepository(SubClient);
export const userRepository = AppDataSource.getRepository(User);
export const clientRepository = AppDataSource.getRepository(Client);
export const productRepository = AppDataSource.getRepository(Product);
export const activityLogRepository = AppDataSource.getRepository(ActivityLog);
export const cartRepository = AppDataSource.getRepository(Cart);
export const cartItemRepository = AppDataSource.getRepository(CartItem);
export const addressRepository = AppDataSource.getRepository(Address);
export const invoiceRepository = AppDataSource.getRepository(Invoice);


export const createOrder = async (
    body: any,
    userId: number
) => {

    const {
        cartId,
        shippingAddressId,
    } = body;

    if (!cartId) {
        throw new Error("Cart is required.");
    }

    if (!shippingAddressId) {
        throw new Error("Shipping address is required.");
    }

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

    if (!user.subClient) {
        throw new Error(
            "Only sub client can place an order."
        );
    }

    const subClient = user.subClient;
    const client = subClient.client;

    if (!client) {
        throw new Error("Client not found.");
    }

    const cart = await cartRepository.findOne({
        where: {
            cartId,
            user_id: userId,
        },
        relations: [
            "cartItems",
            "cartItems.variant",
            "cartItems.variant.product",
            "cartItems.variant.color",
            "cartItems.variant.size",
        ],
    });

    if (!cart) {
        throw new Error("Cart not found.");
    }

    if (!cart.cartItems || cart.cartItems.length === 0) {
        throw new Error("Cart is empty.");
    }

    // --------------------------------
    // 4. Get shipping address
    // --------------------------------

    const shippingAddress =
        await addressRepository.findOne({
            where: {
                addressId: shippingAddressId,
                subClientId: subClient.subClientId,
            },
        });

    if (!shippingAddress) {
        throw new Error(
            "Shipping address not found."
        );
    }

    // --------------------------------
    // 5. Get billing address
    // --------------------------------

    const billingAddress =
        await addressRepository.findOne({
            where: {
                subClientId: subClient.subClientId,
                addressType: AddressType.BILLING,
            },
        });

    if (!billingAddress) {
        throw new Error(
            "Billing address not found."
        );
    }

    // --------------------------------
    // 6. Initialize totals
    // --------------------------------

    let subtotal = 0;
    let totalDiscount = 0;

    const orderItems: OrderItem[] = [];

    // --------------------------------
    // 7. Create order items
    // --------------------------------

    for (const item of cart.cartItems) {

        const variant = item.variant;

        if (!variant || !variant.is_active) {
            throw new Error(
                "Variant not found or inactive."
            );
        }

        if (item.quantity <= 0) {
            throw new Error(
                "Quantity should be greater than zero."
            );
        }

        // Check stock again before creating order
        if (variant.stock < item.quantity) {
            throw new Error(
                `${variant.name} has only ${variant.stock} items available.`
            );
        }

        const price = Number(variant.price);

        const discountPercentage =
            Number(
                variant.discount_percentage || 0
            );

        // --------------------------------
        // Use SAME calculation as addToCart
        // --------------------------------

        const {
            subtotal: itemSubtotal,
            discount: itemDiscount,
            total: itemTotal,
        } = calculateItemAmounts(
            price,
            item.quantity,
            discountPercentage
        );

        // --------------------------------
        // Add to order totals
        // --------------------------------

        subtotal = roundMoney(
            subtotal + itemSubtotal
        );

        totalDiscount = roundMoney(
            totalDiscount + itemDiscount
        );

        // --------------------------------
        // Create order item
        // --------------------------------

        const orderItem =
            orderItemRepository.create({
                variant,
                quantity: item.quantity,
                price,
                discount: itemDiscount,
                total: itemTotal,
            });

        orderItems.push(orderItem);
    }

    // --------------------------------
    // 8. Calculate taxable amount
    // --------------------------------

    const taxableAmount = roundMoney(
        subtotal - totalDiscount
    );

    // --------------------------------
    // 9. Calculate shipping
    // --------------------------------

    const shipping_amount = roundMoney(
        Number(
            subClient.shippingAmount ?? 50
        )
    );

    // --------------------------------
    // 10. Calculate tax
    // --------------------------------

    const taxRate = Number(
        client.taxRate ?? 0
    );

    const tax = roundMoney(
        (taxableAmount * taxRate) / 100
    );

    // --------------------------------
    // 11. Calculate final order total
    // --------------------------------

    const finalTotal = roundMoney(
        taxableAmount +
        tax +
        shipping_amount
    );

    // --------------------------------
    // 12. Create order
    // --------------------------------

    const order = orderRepository.create({
        client,
        subClient,

        subtotal,

        totalDiscount,

        shipping_amount,

        tax,

        totalAmount: finalTotal,

        shippingAddress,

        billingAddress,

        created_by: user.userId,
    });

    // --------------------------------
    // 13. Save order
    // --------------------------------

    const savedOrder =
        await orderRepository.save(order);

    // --------------------------------
    // 14. Generate order number
    // --------------------------------

    savedOrder.orderNumber =
        `ORD${savedOrder.orderId
            .toString()
            .padStart(6, "0")}`;

    await orderRepository.save(
        savedOrder
    );

    // --------------------------------
    // 15. Attach order to order items
    // --------------------------------

    for (const item of orderItems) {
        item.order = savedOrder;
    }

    await orderItemRepository.save(
        orderItems
    );

    // --------------------------------
    // 16. Empty cart
    // --------------------------------

    await cartItemRepository.delete({
        cart_id: cart.cartId,
    });

    // --------------------------------
    // 16. Create activity
    // --------------------------------

    const fullName =
        `${user.firstName} ${user.lastName}`.trim();

    await createActivity(
        `Order "${savedOrder.orderNumber}" has been placed by Dealer "${subClient.companyName}" (${fullName}).`,
        ActivityType.ORDER_CREATED,
        client.clientId,
        subClient.subClientId,
        user.userId
    );

    // --------------------------------
    // 17. Get complete order
    // --------------------------------

    const orderDetails =
        await orderRepository.findOne({
            where: {
                orderId:
                    savedOrder.orderId,
            },
            relations: [
                "client",
                "subClient",

                "items",
                "items.variant",
                "items.variant.product",
                "items.variant.color",
                "items.variant.size",

                "shippingAddress",
                "billingAddress",
            ],
        });

    return orderDetails;
};



export const getOrders = async (
    query: any,
    userId: number
) => {
    const {
        offset = 0,
        limit = 10,
        search,
        status,
        subClientId,
        paymentStatus
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

    const qb = orderRepository
        .createQueryBuilder("order")
        .leftJoinAndSelect("order.client", "client")
        .leftJoinAndSelect("order.subClient", "subClient")
        .leftJoinAndSelect("order.shippingAddress", "shippingAddress")
        .leftJoinAndSelect("order.billingAddress", "billingAddress")
        .leftJoinAndSelect("order.items", "items")
        .leftJoinAndSelect("items.variant", "variant")
        .leftJoinAndSelect("variant.product", "product")
        .leftJoinAndSelect("variant.color", "color")
        .leftJoinAndSelect("variant.size", "size")
        .leftJoinAndSelect("variant.variantImages", "variantImages")
        .leftJoinAndSelect("order.invoice", "invoice")
        .leftJoinAndSelect("invoice.transactions", "transaction");


    // Client can see all dealer orders
    if (user.client) {

        qb.andWhere(
            "client.clientId = :clientId",
            {
                clientId: user.client.clientId
            }
        );

        if (subClientId) {
            qb.andWhere(
                "subClient.subClientId = :subClientId",
                {
                    subClientId: Number(subClientId)
                }
            );
        }

    }

    // Dealer can see only own orders
    else if (user.subClient) {

        qb.andWhere(
            "subClient.subClientId = :subClientId",
            {
                subClientId: user.subClient.subClientId
            }
        );
    }


    // Search by order number OR client name OR product name
    if (search) {

        qb.andWhere(
            `
            (
                client.companyName ILIKE :search
                OR product.productName ILIKE :search
            )
            `,
            {
                search: `%${search}%`
            }
        );

    }


    if (status) {
        qb.andWhere(
            "order.status = :status",
            {
                status
            }
        );
    }
    if (paymentStatus) {
        qb.andWhere(
            "order.payment_status = :paymentStatus",
            {
                paymentStatus,
            }
        );
    }


    qb.orderBy(
        "order.created_at",
        "DESC"
    );


    qb.skip(Number(offset))
        .take(Number(limit));


    const [orders, total] = await qb.getManyAndCount();


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


    // Client can view all orders under their company
    if (user.client) {

        where.client = {
            clientId: user.client.clientId,
        };

    }

    // Dealer can view only own orders
    else if (user.subClient) {

        where.subClient = {
            subClientId: user.subClient.subClientId,
        };

    }



    const order = await orderRepository.findOne({

        where,

        relations: [
            "client",
            "subClient",
            "shippingAddress",
            "billingAddress",
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
        throw new Error("Only client can update order.");
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
        throw new Error(
            "Only pending orders can be updated."
        );
    }


    if (notes !== undefined) {
        order.notes = notes;
    }


    order.updated_by = user.userId;


    await orderRepository.save(order);


    return order;
};

export const getClientDashboard = async (
    clientId: number,
    month?: number,
    year?: number
) => {
    const now = new Date();

    const selectedYear = year ?? now.getFullYear();
    const selectedMonth = month ?? (now.getMonth() + 1);

    // Selected Month
    const startCurrentMonth = new Date(
        selectedYear,
        selectedMonth - 1,
        1,
        0,
        0,
        0
    );

    const endCurrentMonth = new Date(
        selectedYear,
        selectedMonth,
        0,
        23,
        59,
        59,
        999
    );

    // Previous Month
    const previousMonthDate = new Date(
        selectedYear,
        selectedMonth - 2,
        1
    );

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
                    clientId: clientId
                },
            },
            created_at: Between(startCurrentMonth, endCurrentMonth),
        },
    });

    const lastMonthProducts = await productRepository.count({
        where: {
            category: {
                client: {
                    clientId: clientId,
                },
            },
            created_at: Between(startLastMonth, endLastMonth),
        },
    });

    const currentOrders = await orderRepository.count({
        where: {
            client: {
                clientId: clientId,
            },
            created_at: Between(startCurrentMonth, endCurrentMonth),
        },
    });

    const lastMonthOrders = await orderRepository.count({
        where: {
            client: {
                clientId: clientId,
            },
            created_at: Between(startLastMonth, endLastMonth),
        },
    });

    const currentDealers = await subClientRepository.count({
        where: {
            client: {
                clientId: clientId,
            },
            isActive: true,
            createdAt: Between(startCurrentMonth, endCurrentMonth),
        },
    });

    const lastMonthDealers = await subClientRepository.count({
        where: {
            client: {
                clientId: clientId,
            },
            isActive: true,
            createdAt: Between(startLastMonth, endLastMonth),
        },
    });

    const currentRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where("order.clientId = :clientId", {
            clientId: clientId,
        })
        .andWhere("order.created_at BETWEEN :start AND :end", {
            start: startCurrentMonth,
            end: endCurrentMonth,
        })
        .getRawOne();

    const lastMonthRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where("order.clientId = :clientId", {
            clientId: clientId,
        })
        .andWhere("order.created_at BETWEEN :start AND :end", {
            start: startLastMonth,
            end: endLastMonth,
        })
        .getRawOne();
    const totalClients = await clientRepository.count();

    const totalDealers = await subClientRepository.count({
        where: {
            client: {
                clientId,
            },
            isActive: true,
        },
    });

    const totalProducts = await productRepository.count({
        where: {
            category: {
                client: {
                    clientId: clientId,
                },
            },
        },
    });

    const totalOrders = await orderRepository.count({
        where: {
            client: {
                clientId: clientId,
            },
        },
    });

    const totalVariants = await variantRepository.count({
        where: {
            product: {
                category: {
                    client: {
                        clientId,
                    },
                },
            },
        },
    });

    const currentVariants = await variantRepository.count({
        where: {
            product: {
                category: {
                    client: {
                        clientId,
                    },
                },
            },
            created_at: Between(startCurrentMonth, endCurrentMonth),
        },
    });

    const lastMonthVariants = await variantRepository.count({
        where: {
            product: {
                category: {
                    client: {
                        clientId,
                    },
                },
            },
            created_at: Between(startLastMonth, endLastMonth),
        },
    });

    const revenue = await orderRepository
        .createQueryBuilder("order")
        .select("SUM(order.totalAmount)", "revenue")
        .where("order.clientId = :clientId", {
            clientId: clientId,
        })
        .getRawOne();

    const topClients = await orderRepository
        .createQueryBuilder("order")
        .leftJoin("order.subClient", "subClient")
        .select("subClient.companyName", "companyName")
        .addSelect("SUM(order.totalAmount)", "revenue")
        .where("order.clientId = :clientId", { clientId })
        .groupBy("subClient.subClientId")
        .orderBy("SUM(order.totalAmount)", "DESC")
        .limit(10)
        .getRawMany();

    const revenueOverview = [];

    const daysInMonth = endCurrentMonth.getDate();

    const weekRanges = [
        { label: "Week 1", start: 1, end: 7 },
        { label: "Week 2", start: 8, end: 14 },
        { label: "Week 3", start: 15, end: 21 },
        { label: "Week 4", start: 22, end: daysInMonth },
    ];

    for (const week of weekRanges) {

        const startDate = new Date(
            selectedYear,
            selectedMonth - 1,
            week.start,
            0,
            0,
            0
        );

        const endDate = new Date(
            selectedYear,
            selectedMonth - 1,
            week.end,
            23,
            59,
            59,
            999
        );

        const weeklyRevenue = await orderRepository
            .createQueryBuilder("order")
            .select(
                "COALESCE(SUM(order.totalAmount),0)",
                "revenue"
            )
            .where("order.clientId = :clientId", {
                clientId,
            })
            .andWhere(
                "order.created_at BETWEEN :start AND :end",
                {
                    start: startDate,
                    end: endDate,
                }
            )
            .getRawOne();

        revenueOverview.push({
            week: week.label,
            revenue: Number(weeklyRevenue.revenue),
        });
    }

    const recentOrders = await orderRepository.find({
        where: {
            client: {
                clientId: clientId,
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
                clientId: clientId,
            },
            isActive: true,
        },
        order: {
            createdAt: "DESC",
        },
        take: 10,
    });

    const activityFeed = await activityLogRepository.find({
        where: {
            clientId: clientId,
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

            totalVariants: {
                total: totalVariants,
                thisMonth: currentVariants,
                lastMonth: lastMonthVariants,
                percentage: calculatePercentage(
                    currentVariants,
                    lastMonthVariants
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
        revenueOverview,
        topClients,
        recentClients,
        recentOrders,
        activityFeed,
    };
};

export const getAdminDashboard = async (
    userId: number,
    month?: number,
    year?: number
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

    const selectedYear = year ?? now.getFullYear();
    const selectedMonth = month ?? (now.getMonth() + 1);

    // Selected month
    const startCurrentMonth = new Date(
        selectedYear,
        selectedMonth - 1,
        1,
        0,
        0,
        0
    );

    const endCurrentMonth = new Date(
        selectedYear,
        selectedMonth,
        0,
        23,
        59,
        59,
        999
    );

    // Previous month
    const previousMonthDate = new Date(
        selectedYear,
        selectedMonth - 2,
        1
    );

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
                endCurrentMonth
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
                endCurrentMonth
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
                endCurrentMonth
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
    const currentRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where(
            "order.created_at BETWEEN :start AND :end",
            {
                start: startCurrentMonth,
                end: endCurrentMonth,
            }
        )
        .getRawOne();

    const lastMonthRevenue = await orderRepository
        .createQueryBuilder("order")
        .select("COALESCE(SUM(order.totalAmount),0)", "revenue")
        .where(
            "order.created_at BETWEEN :start AND :end",
            {
                start: startLastMonth,
                end: endLastMonth,
            }
        )
        .getRawOne();

    // Top Clients by Revenue
    const topClients = await orderRepository
        .createQueryBuilder("order")
        .leftJoin("order.client", "client")
        .select("client.clientId", "clientId")
        .addSelect("client.companyName", "companyName")
        .addSelect("SUM(order.totalAmount)", "revenue")
        .where(
            "order.created_at BETWEEN :start AND :end",
            {
                start: startCurrentMonth,
                end: endCurrentMonth,
            }
        )
        .groupBy("client.clientId")
        .addGroupBy("client.companyName")
        .orderBy("SUM(order.totalAmount)", "DESC")
        .limit(10)
        .getRawMany();

    const currentDealers = await subClientRepository.count({
        where: {
            createdAt: Between(
                startCurrentMonth,
                endCurrentMonth
            )
        }
    });

    const lastMonthDealers = await subClientRepository.count({
        where: {
            createdAt: Between(
                startLastMonth,
                endLastMonth
            )
        }
    });

    // Revenue Overview (Weekly)
    const revenueOverview = [];

    const daysInMonth = endCurrentMonth.getDate();

    const weekRanges = [
        { label: "Week 1", start: 1, end: 7 },
        { label: "Week 2", start: 8, end: 14 },
        { label: "Week 3", start: 15, end: 21 },
        { label: "Week 4", start: 22, end: daysInMonth },
    ];

    for (const week of weekRanges) {

        const startDate = new Date(
            selectedYear,
            selectedMonth - 1,
            week.start,
            0,
            0,
            0
        );

        const endDate = new Date(
            selectedYear,
            selectedMonth - 1,
            week.end,
            23,
            59,
            59,
            999
        );

        const revenue = await orderRepository
            .createQueryBuilder("order")
            .select(
                "COALESCE(SUM(order.totalAmount),0)",
                "revenue"
            )
            .where(
                "order.created_at BETWEEN :start AND :end",
                {
                    start: startDate,
                    end: endDate,
                }
            )
            .getRawOne();

        revenueOverview.push({
            week: week.label,
            revenue: Number(revenue.revenue),
        });
    }

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
                total: Number(currentRevenue.revenue), // revenue for selected/current month
                thisMonth: Number(currentRevenue.revenue),
                lastMonth: Number(lastMonthRevenue.revenue),
                percentage: calculatePercentage(
                    Number(currentRevenue.revenue),
                    Number(lastMonthRevenue.revenue)
                ),
            },
        },

        revenueOverview,
        topClients,
        recentClients,
        recentOrders,
        activityFeed,
    };
};

export const updateOrderStatus = async (
    orderId: number,
    body: any,
    userId: number
) => {
    const {
        status,
        rejectionReason
    } = body;
    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "role",
            "client",
        ],
    });
    if (!user) {
        throw new Error("User not found.");
    }
    if (user.role.name !== "client") {
        throw new Error(
            "Only client can approve or reject order."
        );
    }
    if (!user.client) {
        throw new Error("Client profile not found.");
    }
    const order = await orderRepository.findOne({
        where: {
            orderId,
            client: {
                clientId: user.client.clientId,
            },
        },
        relations: [
            "client",
            "subClient",
        ],
    });
    if (!order) {
        throw new Error("Order not found.");
    }

    if (
        status === OrderStatus.APPROVED &&
        order.status !== OrderStatus.PENDING
    ) {
        throw new Error("Only pending orders can be approved.");
    }

    if (
        status === OrderStatus.REJECTED &&
        order.status !== OrderStatus.PENDING
    ) {
        throw new Error("Only pending orders can be rejected.");
    }

    if (
        status === OrderStatus.COMPLETED &&
        order.status !== OrderStatus.PROCESSING
    ) {
        throw new Error(
            "Only processing orders can be completed."
        );
    }
    if (
        status !== OrderStatus.APPROVED &&
        status !== OrderStatus.REJECTED &&
        status !== OrderStatus.COMPLETED
    ) {
        throw new Error(
            "Invalid order status."
        );
    }
    if (status === OrderStatus.APPROVED) {
        const existingInvoice = await invoiceRepository.findOne({
            where: {
                order: {
                    orderId: order.orderId
                }
            }
        });

        if (existingInvoice) {
            throw new Error(
                "Invoice already generated for this order."
            );
        }
        order.status = OrderStatus.APPROVED;
        order.approvedBy = user;
        order.approved_at = new Date();

        await orderRepository.save(order);

        const invoice = invoiceRepository.create({
            invoiceNumber: await generateInvoiceNumber(),
            order,
            amount: order.totalAmount,
            tax: order.tax,
            shipping_amount:
                order.shipping_amount,
            status: InvoiceStatus.UNPAID,
        });

        await invoiceRepository.save(invoice);

        await createActivity(
            `Invoice ${invoice.invoiceNumber} generated.`,
            ActivityType.INVOICE_CREATED,
            order.client.clientId,
            order.subClient.subClientId,
            user.userId
        );
    }
    if (status === OrderStatus.REJECTED) {
        if (!rejectionReason) {
            throw new Error(
                "Rejection reason is required."
            );
        }
        order.status = OrderStatus.REJECTED;
        order.rejectedBy = user;
        order.rejected_at = new Date();
        order.rejection_reason = rejectionReason;
        await createActivity(
            `Order "${order.orderNumber}" rejected.`,
            ActivityType.ORDER_REJECTED,
            order.client.clientId,
            order.subClient.subClientId,
            user.userId
        );
    }
    if (status === OrderStatus.COMPLETED) {
        order.status = OrderStatus.COMPLETED;
        order.updated_by = user?.userId;
        await createActivity(
            `Order "${order.orderNumber}" completed.`,
            ActivityType.ORDER_COMPLETED,
            order.client.clientId,
            order.subClient.subClientId,
            user.userId
        );
    }
    order.updated_by = user.userId;
    await orderRepository.save(order);

    const dealerUser = await userRepository.findOne({
        where: {
            subClient: {
                subClientId: order.subClient.subClientId,
            },
        },
    });

    if (dealerUser?.fcm_token) {

        let title = "";
        let message = "";

        switch (status) {
            case OrderStatus.APPROVED:
                title = "Order Approved";
                message = `Your order ${order.orderNumber} has been approved.`;
                break;

            case OrderStatus.REJECTED:
                title = "Order Rejected";
                message = `Your order ${order.orderNumber} has been rejected.`;
                break;

            case OrderStatus.COMPLETED:
                title = "Order Completed";
                message = `Your order ${order.orderNumber} has been completed.`;
                break;
        }

        await sendPushNotification(
            dealerUser.fcm_token,
            title,
            message,
            {
                orderId: order.orderId.toString(),
                status: order.status,
                type: "ORDER_STATUS",
            }
        );
    }
    return order;
};

export const generateInvoiceNumber = async (): Promise<string> => {
    const invoices = await invoiceRepository.find({
        order: {
            invoiceId: "DESC",
        },
        take: 1,
    });

    const lastInvoice = invoices[0];

    if (!lastInvoice) {
        return "INV000001";
    }

    const lastNumber = parseInt(
        lastInvoice.invoiceNumber.replace("INV", ""),
        10
    );

    return `INV${String(lastNumber + 1).padStart(6, "0")}`;
};

export const selectPaymentMethod = async (
    orderId: number,
    body: any,
    userId: number
) => {

    const {
        payment_method,
        paymentNotes,
    } = body;

    if (!payment_method) {
        throw new Error("Payment method is required.");
    }

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "subClient",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (!user.subClient) {
        throw new Error("Only dealer can select payment method.");
    }

    const order = await orderRepository.findOne({
        where: {
            orderId,
            subClient: {
                subClientId: user.subClient.subClientId,
            },
        },
        relations: [
            "client",
            "subClient",
        ],
    });

    if (!order) {
        throw new Error("Order not found.");
    }

    if (order.status !== OrderStatus.APPROVED) {
        throw new Error(
            "Payment can only be selected after order approval."
        );
    }

    if (order.payment_method) {
        throw new Error(
            "Payment method has already been selected."
        );
    }

    order.payment_method = payment_method;
    order.paymentNotes = paymentNotes ?? null;
    order.updated_by = user.userId;

    await orderRepository.save(order);

    await createActivity(
        `Payment method "${payment_method}" selected for Order "${order.orderNumber}".`,
        ActivityType.ORDER_UPDATED,
        order.client.clientId,
        order.subClient.subClientId,
        user.userId
    );

    return order;
};

const roundMoney = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

const calculateItemAmounts = (
    price: number,
    quantity: number,
    discountPercentage: number
) => {
    const subtotal = roundMoney(price * quantity);

    const discount = roundMoney(
        (subtotal * discountPercentage) / 100
    );

    const total = roundMoney(
        subtotal - discount
    );

    return {
        subtotal,
        discount,
        total,
    };
};