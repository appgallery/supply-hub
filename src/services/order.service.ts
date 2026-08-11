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
        shipping_amount = 0,
        tax_amount = 0,
        payment_method,
        notes,
    } = body;
    if (!cartId) {
        throw new Error("Cart is required.");
    }
    if (!shippingAddressId) {
        throw new Error("Shipping address is required.");
    }
    if (!payment_method) {
        throw new Error("Payment method is required.");
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
        throw new Error("Only sub client can place an order.");
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
    if (cart.cartItems.length === 0) {
        throw new Error("Cart is empty.");
    }
    const shippingAddress = await addressRepository.findOne({
        where: {
            addressId: shippingAddressId,
            subClientId: subClient.subClientId,
        },
    });


    if (!shippingAddress) {
        throw new Error("Shipping address not found.");
    }
    const billingAddress = await addressRepository.findOne({
        where: {
            subClientId: subClient.subClientId,
            addressType: AddressType.BILLING,
        },
    });
    if (!billingAddress) {
        throw new Error("Billing address not found.");
    }
    let subtotal = 0;
    let totalDiscount = 0;
    const orderItems: OrderItem[] = [];
    const variantUpdates: {
        variant: Variant;
        quantity: number;
    }[] = [];
    for (const item of cart.cartItems) {
        const variant = item.variant;
        if (!variant || !variant.is_active) {
            throw new Error("Variant not found.");
        }
        if (item.quantity <= 0) {
            throw new Error("Quantity should be greater than zero.");
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

    const finalTotal =
        subtotal -
        totalDiscount +
        Number(shipping_amount) +
        Number(tax_amount);

    const order = orderRepository.create({
        client,
        subClient,
        notes,
        subtotal,
        totalDiscount,
        shipping_amount: Number(shipping_amount),
        totalAmount: finalTotal,
        payment_method,
        shippingAddress,
        billingAddress,
        created_by: user.userId,
    });

    const savedOrder: Order = await orderRepository.save(order);

    savedOrder.orderNumber =
        `ORD${savedOrder.orderId.toString().padStart(6, "0")}`;

    await orderRepository.save(savedOrder);
    const fullName =
        `${user.firstName} ${user.lastName}`;

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
    // clear cart after successful order creation

    await cartItemRepository.delete({
        cart_id: cart.cartId,
    });

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
    // Client can see all dealer orders
    if (user.client) {
        where.client = {
            clientId: user.client.clientId,
        };
        if (subClientId) {
            where.subClient = {
                subClientId: Number(subClientId),
            };
        }

    }

    // Dealer can see only own orders
    else if (user.subClient) {

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
    const [orders, total] = await orderRepository.findAndCount({
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
            "items.variant.variantImages"
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
    clientId: number
) => {
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
                    clientId: clientId
                },
            },
            created_at: Between(startCurrentMonth, now),
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
            created_at: Between(startCurrentMonth, now),
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
            createdAt: Between(startCurrentMonth, now),
        },
    });

    const lastMonthDealers = await subClientRepository.count({
        where: {
            client: {
                clientId: clientId,
            },
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
            end: now,
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

    if (order.status !== OrderStatus.PENDING) {
        throw new Error(
            "Only pending orders can be updated."
        );
    }
    if (
        status !== OrderStatus.APPROVED &&
        status !== OrderStatus.REJECTED
    ) {
        throw new Error(
            "Invalid order status."
        );
    }
    if (status === OrderStatus.APPROVED) {
        order.status = OrderStatus.APPROVED;
        order.approvedBy = user;
        order.approved_at = new Date();

        await orderRepository.save(order);

        const invoice = invoiceRepository.create({
            invoiceNumber: await generateInvoiceNumber(),
            order,
            amount: order.totalAmount,
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

        const title =
            status === OrderStatus.APPROVED
                ? "Order Approved"
                : "Order Rejected";

        const message =
            status === OrderStatus.APPROVED
                ? `Your order ${order.orderNumber} has been approved.`
                : `Your order ${order.orderNumber} has been rejected.`;

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