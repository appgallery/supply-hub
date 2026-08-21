import crypto from "crypto";
import { AppDataSource } from "../database/data-source";
import axios from "axios";
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
import { Client } from "../entities/Client";
import { Variant } from "../entities/Variants";

const orderRepository = AppDataSource.getRepository(Order);
const transactionRepository = AppDataSource.getRepository(Transaction);
const invoiceRepository = AppDataSource.getRepository(Invoice);
const userRepository = AppDataSource.getRepository(User);
const clientRepository = AppDataSource.getRepository(Client)
const variantRepository = AppDataSource.getRepository(Variant)

export const generateRazorpayOAuthUrl = async (
    clientId: number
) => {
    const client = await clientRepository.findOne({
        where: { clientId },
    });

    if (!client) {
        throw new Error("Client not found.");
    }

    // Generate random state
    const state = crypto.randomBytes(24).toString("hex");

    // Save state in DB
    client.razorpayOAuthState = state;
    client.razorpayOAuthStateExpiry = new Date(
        Date.now() + 10 * 60 * 1000 // 10 minutes
    );

    await clientRepository.save(client);

    // Generate OAuth URL
    const params = new URLSearchParams({
        client_id: process.env.RAZORPAY_CLIENT_ID!,
        response_type: "code",
        redirect_uri: process.env.RAZORPAY_REDIRECT_URL!,
        state,
    });

    params.append("scope[]", "read_write");

    return {
        authorizationUrl: `https://auth.razorpay.com/authorize?${params.toString()}`,
    };
};


export const exchangeAuthorizationCode = async (
    clientId: number,
    code: string,
    // state: string
) => {

    const client = await clientRepository.findOne({
        where: {
            clientId,
        },
    });

    if (!client) {
        throw new Error("Client not found.");
    }

    // // Validate state
    // if (client.razorpayOAuthState !== state) {
    //     throw new Error("Invalid OAuth state.");
    // }

    if (
        !client.razorpayOAuthStateExpiry ||
        client.razorpayOAuthStateExpiry < new Date()
    ) {
        throw new Error("OAuth state expired.");
    }

    const response = await axios.post(
        "https://auth.razorpay.com/token",
        {
            client_id: process.env.RAZORPAY_CLIENT_ID,
            client_secret: process.env.RAZORPAY_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: process.env.RAZORPAY_REDIRECT_URL,
        },
        {
            headers: {
                "Content-Type": "application/json",
            },
        }
    );

    const token = response.data;

    client.razorpayAccessToken = token.access_token;
    client.razorpayRefreshToken = token.refresh_token;

    // Clear state after successful OAuth
    client.razorpayOAuthState = null;
    client.razorpayOAuthStateExpiry = null;

    await clientRepository.save(client);

    return {
        connected: true,
    };
};

export const processWebhook = async (
    body: Buffer,
    signature: string
) => {

    const expectedSignature = crypto
        .createHmac(
            "sha256",
            process.env.RAZORPAY_WEBHOOK_SECRET!
        )
        .update(body)
        .digest("hex");


    if (expectedSignature !== signature) {
        throw new Error("Invalid webhook signature.");
    }

    const payload = JSON.parse(
        body.toString()
    );

    const event = payload.event;

    switch (event) {

        case "account.instantly_activated":
            {
                const accountId =
                    payload.payload?.account?.entity?.id;
                if (!accountId) {
                    throw new Error(
                        "Razorpay account id missing."
                    );
                }
                const client =
                    await clientRepository.findOne({
                        where: {
                            razorpayLinkedAccountId: accountId,
                        },
                    });
                if (client) {
                    client.razorpayAccountStatus =
                        "ACTIVE";
                    await clientRepository.save(client);
                }
                break;
            }

        case "account.activated_kyc_pending":
            {
                const accountId =
                    payload.payload?.account?.entity?.id;
                const client =
                    await clientRepository.findOne({
                        where: {
                            razorpayLinkedAccountId: accountId,
                        },
                    });

                if (client) {
                    client.razorpayAccountStatus =
                        "KYC_PENDING";
                    await clientRepository.save(client);
                }

                break;
            }

        default:
            console.log(
                "Unhandled Razorpay event:",
                event
            );
    }

    return true;
};


export const fetchRazorpayStatus = async (
    clientId: number
) => {

    const client = await clientRepository.findOne({
        where: {
            clientId,
        },
        select: {
            clientId: true,
            razorpayLinkedAccountId: true,
            razorpayAccountStatus: true,
        },
    });


    if (!client) {
        throw new Error("Client not found.");
    }

    return {
        connected: !!client.razorpayLinkedAccountId,
        accountId: client.razorpayLinkedAccountId,
        status: client.razorpayAccountStatus,
    };
};

export const removeRazorpayConnection = async (
    clientId: number
) => {
    const client = await clientRepository.findOne({
        where: {
            clientId,
        },
    });

    if (!client) {
        throw new Error("Client not found.");
    }

    client.razorpayLinkedAccountId = null;
    client.razorpayAccountStatus = "PENDING";
    client.razorpayAccessToken = null;
    client.razorpayRefreshToken = null;
    client.razorpayOAuthState = null;
    client.razorpayOAuthStateExpiry = null;
    await clientRepository.save(client);

    return true;
};

export const deleteSubMerchant = async (accountId: string) => {
  const response = await axios.delete(
    `https://api.razorpay.com/v2/accounts/${accountId}`,
    {
      auth: {
        username: process.env.RAZORPAY_KEY_ID!,
        password: process.env.RAZORPAY_KEY_SECRET!,
      },
    }
  );

  return response.data;
};


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
        throw new Error(
            "Invoice not found."
        );
    }

    if (invoice.status === InvoiceStatus.PAID) {
        throw new Error(
            "Invoice already paid."
        );
    }

    const client =
        invoice.order.client;

    if (!client) {
        throw new Error(
            "Client not found."
        );
    }

    // Client must be connected with Razorpay Partner
    if (!client.razorpayLinkedAccountId) {
        throw new Error(
            "Client Razorpay account is not connected."
        );
    }

    // Prevent duplicate payment order creation
    const existingTransaction =
        await transactionRepository.findOne({
            where: {
                invoice: {
                    invoiceId,
                },
                status: TransactionStatus.PENDING,
            },
            relations: [
                "invoice",
            ],
        });

    if (existingTransaction) {
        return {
            transactionId:
                existingTransaction.transactionId,
            razorpayOrderId:
                existingTransaction.razorpayOrderId,
            amount:
                Number(existingTransaction.amount) * 100,
            currency:
                existingTransaction.currency,
            key:
                process.env.RAZORPAY_KEY_ID,
        };
    }
    // Create Razorpay Order

    const razorpayOrder =
        await razorpay.orders.create({

            amount:
                Math.round(
                    Number(invoice.amount) * 100
                ),

            currency:
                "INR",

            receipt:
                invoice.invoiceNumber,

            notes: {
                invoiceId:
                    invoice.invoiceId.toString(),

                clientId:
                    client.clientId.toString(),
            }
        });

    // Create Transaction

    const transaction =
        transactionRepository.create({
            invoice,
            razorpayOrderId:
                razorpayOrder.id,
            amount:
                Number(invoice.amount),
            currency:
                razorpayOrder.currency,
            status:
                TransactionStatus.PENDING,
            gateway:
                "RAZORPAY",
        });

    const savedTransaction =
        await transactionRepository.save(
            transaction
        );

    return {
        transactionId:
            savedTransaction.transactionId,
        invoiceId:
            invoice.invoiceId,
        invoiceNumber:
            invoice.invoiceNumber,
        razorpayOrderId:
            razorpayOrder.id,
        amount:
            razorpayOrder.amount,
        currency:
            razorpayOrder.currency,
        key:
            process.env.RAZORPAY_KEY_ID,
    };
};

export const verifyRazorpayPayment = async (
    payload: {
        transactionId: number;
        razorpayPaymentId: string;
        razorpayOrderId: string;
        razorpaySignature: string;
    }
) => {
    const {
        transactionId,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
    } = payload;

    const transaction =
        await transactionRepository.findOne({

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
        throw new Error(
            "Transaction not found."
        );
    }

    if (
        transaction.status ===
        TransactionStatus.SUCCESS
    ) {
        throw new Error(
            "Payment already verified."
        );
    }

    // Verify Razorpay Signature
    const generatedSignature =
        crypto
        .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET!
        )
        .update(
            `${razorpayOrderId}|${razorpayPaymentId}`
        )
        .digest("hex");

    if (
        generatedSignature !==
        razorpaySignature
    ) {
        throw new Error(
            "Invalid payment signature."
        );
    }

    // Update transaction
    transaction.razorpayPaymentId =
        razorpayPaymentId;
    transaction.razorpaySignature =
        razorpaySignature;
    transaction.status =
        TransactionStatus.SUCCESS;

    await transactionRepository.save(
        transaction
    );

    // Update invoice
    const invoice =
        transaction.invoice;
    invoice.status =
        InvoiceStatus.PAID;

    await invoiceRepository.save(
        invoice
    );
    // Update order
    const order =
        invoice.order;
    order.status =
        OrderStatus.PROCESSING;
    await orderRepository.save(
        order
    );

    // Reduce stock after payment
    const orderDetails =
        await orderRepository.findOne({
            where: {
                orderId: order.orderId,
            },
            relations: [
                "items",
                "items.variant",
            ],
        });

    if(orderDetails){
        for(
            const item of orderDetails.items
        ){
            item.variant.stock -=
                item.quantity;
            await variantRepository.save(
                item.variant
            );
        }
    }

    return {
        transactionId:
            transaction.transactionId,
        invoiceId:
            invoice.invoiceId,
        orderId:
            order.orderId,
        status:
            transaction.status,
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
