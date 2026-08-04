import crypto from "crypto";
import { AppDataSource } from "../database/data-source";

import { Order } from "../entities/Order";
import { Transaction } from "../entities/Transaction";
import { razorpay } from "../config/razorpay";
import {
    OrderStatus,
    PaymentStatus,
    TransactionStatus,
    ActivityType,
    InvoiceStatus,
} from "../utils/constants";
import { createActivity } from "../utils/helper";
import { Invoice } from "../entities/Invoice";
import { User } from "../entities/User";

const orderRepository = AppDataSource.getRepository(Order);
const transactionRepository = AppDataSource.getRepository(Transaction);
const invoiceRepository = AppDataSource.getRepository(Invoice);
const userRepository = AppDataSource.getRepository(User);

export const createPayment = async (
    invoiceId: number
) => {

    const invoice = await invoiceRepository.findOne({
        where: {
            invoiceId,
        },
        relations: [
            "order",
            "order.client",
            "order.subClient",
        ],
    });

    if (!invoice) {
        throw new Error("Invoice not found.");
    }

    if (invoice.status === InvoiceStatus.PAID) {
        throw new Error("Invoice already paid.");
    }

    if (!invoice.order.client.razorpayLinkedAccountId) {
        throw new Error("Client is not onboarded with Razorpay Partner.");
    }

    const existingTransaction = await transactionRepository.findOne({
        where: {
            invoice: {
                invoiceId,
            },
            status: TransactionStatus.SUCCESS,
        },
        relations: [
            "invoice",
        ],
    });

    if (existingTransaction) {
        throw new Error("Payment already completed.");
    }

    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(Number(invoice.amount) * 100),
        currency: "INR",
        receipt: invoice.invoiceNumber
    });

    const transaction = transactionRepository.create({
        invoice,
        razorpayOrderId: razorpayOrder.id,
        amount: Number(invoice.amount),
        currency: razorpayOrder.currency,
        status: TransactionStatus.PENDING,
        gateway: "RAZORPAY",
    });

    const savedTransaction =
        await transactionRepository.save(transaction);

    return {
        transactionId: savedTransaction.transactionId,
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
    };
};

export const verifyPayment = async (
    body: any,
    userId: number
) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = body;

    if (!razorpay_order_id) {
        throw new Error("Razorpay Order Id is required.");
    }

    if (!razorpay_payment_id) {
        throw new Error("Razorpay Payment Id is required.");
    }

    if (!razorpay_signature) {
        throw new Error("Razorpay Signature is required.");
    }

    const user = await userRepository.findOne({
        where: { userId },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const transaction = await transactionRepository.findOne({
        where: {
            razorpayOrderId: razorpay_order_id,
        },
        relations: [
            "invoice",
            "invoice.order",
            "invoice.order.client",
            "invoice.order.subClient",
        ],
    });

    if (!transaction) {
        throw new Error("Transaction not found.");
    }

    if (transaction.status === TransactionStatus.SUCCESS) {
        throw new Error("Payment already verified.");
    }

    const generatedSignature = crypto
        .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET!
        )
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    if (generatedSignature !== razorpay_signature) {
        transaction.status = TransactionStatus.FAILED;

        await transactionRepository.save(transaction);

        throw new Error("Invalid payment signature.");
    }

    // Update Transaction
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.status = TransactionStatus.SUCCESS;

    await transactionRepository.save(transaction);

    // Update Invoice
    const invoice = transaction.invoice;

    invoice.status = InvoiceStatus.PAID;
    invoice.updatedBy = user;

    await invoiceRepository.save(invoice);

    // Update Order
    const order = invoice.order;

    order.payment_status = PaymentStatus.PAID;

    if (order.status === OrderStatus.APPROVED) {
        order.status = OrderStatus.PROCESSING;
    }

    order.updated_by = user.userId;

    await orderRepository.save(order);

    // Activity
    await createActivity(
        `Payment received for Invoice "${invoice.invoiceNumber}".`,
        ActivityType.PAYMENT_RECEIVED,
        order.client.clientId,
        order.subClient.subClientId,
        user.userId
    );

    return {
        success: true,
        message: "Payment verified successfully.",
        transactionId: transaction.transactionId,
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        paymentId: transaction.razorpayPaymentId,
        paymentStatus: order.payment_status,
        invoiceStatus: invoice.status,
        orderStatus: order.status,
    };
};

export const getPaymentDetails = async (
    transactionId: number
) => {

    const transaction = await transactionRepository.findOne({
        where: {
            transactionId,
        },
        relations: [
            "invoice",
            "invoice.order",
            "invoice.order.client",
            "invoice.order.subClient",
        ],
    });

    if (!transaction) {
        throw new Error("Transaction not found.");
    }

    const invoice = transaction.invoice;
    const order = invoice.order;

    return {
        transactionId: transaction.transactionId,
        gateway: transaction.gateway,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        razorpayOrderId: transaction.razorpayOrderId,
        razorpayPaymentId: transaction.razorpayPaymentId,
        invoice: {
            invoiceId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            invoiceStatus: invoice.status,
            invoiceAmount: invoice.amount,
        },
        order: {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            paymentStatus: order.payment_status,
            totalAmount: order.totalAmount,
        },
        client: {
            clientId: order.client.clientId,
            companyName: order.client.companyName,
        },
        subClient: {
            subClientId: order.subClient.subClientId,
            companyName: order.subClient.companyName,
        },
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
    };
};

// export const razorpayWebhook = async (
//     payload: any,
//     razorpaySignature: string
// ) => {

//     const expectedSignature = crypto
//         .createHmac(
//             "sha256",
//             process.env.RAZORPAY_WEBHOOK_SECRET!
//         )
//         .update(JSON.stringify(payload))
//         .digest("hex");

//     if (expectedSignature !== razorpaySignature) {
//         throw new Error("Invalid webhook signature.");
//     }

//     const event = payload.event;

//     if (event === "payment.captured") {

//         const payment = payload.payload.payment.entity;

//         const transaction = await transactionRepository.findOne({
//             where: {
//                 razorpayOrderId: payment.order_id,
//             },
//             relations: [
//                 "order",
//                 "order.client",
//                 "order.subClient",
//             ],
//         });

//         if (!transaction) {
//             return;
//         }

//         transaction.status = TransactionStatus.SUCCESS;
//         transaction.razorpayPaymentId = payment.id;

//         await transactionRepository.save(transaction);

//         const order = transaction.order;

//         order.payment_status = PaymentStatus.PAID;

//         if (order.status === OrderStatus.PENDING) {
//             order.status = OrderStatus.CONFIRMED;
//         }

//         await orderRepository.save(order);

//         await createActivity(
//             `Payment received for Order "${order.orderNumber}".`,
//             ActivityType.PAYMENT_RECEIVED,
//             order.client.clientId,
//             order.subClient.subClientId,
//             order.created_by
//         );
//     }

//     if (event === "payment.failed") {

//         const payment = payload.payload.payment.entity;

//         const transaction = await transactionRepository.findOne({
//             where: {
//                 razorpayOrderId: payment.order_id,
//             },
//         });

//         if (!transaction) {
//             return;
//         }

//         transaction.status = TransactionStatus.FAILED;
//         transaction.razorpayPaymentId = payment.id;

//         await transactionRepository.save(transaction);

//         const order = await orderRepository.findOne({
//             where: {
//                 orderId: transaction.order.orderId,
//             },
//         });

//         if (order) {

//             order.payment_status = PaymentStatus.FAILED;

//             await orderRepository.save(order);
//         }
//     }

//     if (event === "refund.processed") {

//         const refund = payload.payload.refund.entity;

//         const transaction = await transactionRepository.findOne({
//             where: {
//                 razorpayPaymentId: refund.payment_id,
//             },
//             relations: [
//                 "order",
//             ],
//         });

//         if (!transaction) {
//             return;
//         }

//         transaction.status = TransactionStatus.REFUNDED;

//         await transactionRepository.save(transaction);

//         transaction.order.payment_status = PaymentStatus.REFUNDED;

//         await orderRepository.save(transaction.order);
//     }
// };