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
import qs from "qs";

const orderRepository = AppDataSource.getRepository(Order);
const transactionRepository = AppDataSource.getRepository(Transaction);
const invoiceRepository = AppDataSource.getRepository(Invoice);
const userRepository = AppDataSource.getRepository(User);
const clientRepository = AppDataSource.getRepository(Client);
const variantRepository = AppDataSource.getRepository(Variant);

export const generateRazorpayOAuthUrl = async (
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

    // Generate random OAuth state
    const state = crypto
        .randomBytes(24)
        .toString("hex");

    client.razorpayOAuthState = state;

    client.razorpayOAuthStateExpiry =
        new Date(
            Date.now() + 10 * 60 * 1000
        );

    await clientRepository.save(client);

    const params = new URLSearchParams({
        client_id:
            process.env.RAZORPAY_CLIENT_ID!,

        response_type: "code",

        redirect_uri:
            process.env.RAZORPAY_REDIRECT_URL!,

        state,
    });

    params.append(
        "scope[]",
        "read_write"
    );

    return {
        authorizationUrl:
            `https://auth.razorpay.com/authorize?${params.toString()}`,
    };
};

export const exchangeAuthorizationCode = async (
    clientId: number,
    code: string,
    // state?: string
) => {

    if (!code) {
        throw new Error(
            "Authorization code is required."
        );
    }

    const client = await clientRepository
        .createQueryBuilder("client")
        .addSelect([
            "client.razorpayOAuthState",
            "client.razorpayOAuthStateExpiry",
        ])
        .where(
            "client.clientId = :clientId",
            { clientId }
        )
        .getOne();

    if (!client) {
        throw new Error("Client not found.");
    }

    // -----------------------------------------
    // Validate OAuth state
    // -----------------------------------------

    // if (
    //     !client.razorpayOAuthState ||
    //    !state | |
    //     client.razorpayOAuthState !== state
    // ) {
    //     throw new Error(
    //         "Invalid OAuth state."
    //     );
    // }

    // -----------------------------------------
    // Validate state expiry
    // -----------------------------------------

    if (
        !client.razorpayOAuthStateExpiry ||
        client.razorpayOAuthStateExpiry <= new Date()
    ) {
        throw new Error(
            "OAuth state expired."
        );
    }

    try {

        // Don't decode unless you actually need to.
        // Express usually gives you the decoded query parameter.
        const authorizationCode =
            decodeURIComponent(code);

        const response = await axios.post(
            "https://auth.razorpay.com/token",

            qs.stringify({
                client_id:
                    process.env.RAZORPAY_CLIENT_ID,

                client_secret:
                    process.env.RAZORPAY_CLIENT_SECRET,

                grant_type:
                    "authorization_code",

                code:
                    authorizationCode,

                redirect_uri:
                    process.env.RAZORPAY_REDIRECT_URL,

                mode: "test"
            }),

            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },
            }
        );

        const token = response.data;

        // -----------------------------------------
        // Save Razorpay OAuth information
        // -----------------------------------------

        client.razorpayConnected = true;

        client.razorpayTokenType =
            token.token_type ?? "Bearer";

        client.razorpayAccessToken =
            token.access_token;

        client.razorpayPublicToken =
            token.public_token ?? null;

        client.razorpayRefreshToken =
            token.refresh_token ?? null;

        client.razorpayLinkedAccountId =
            token.razorpay_account_id ?? null;

        client.razorpayAccessTokenExpiresAt =
            token.expires_in
                ? new Date(
                    Date.now() +
                    Number(token.expires_in) * 1000
                )
                : null;

        // -----------------------------------------
        // Clear OAuth state
        // -----------------------------------------

        client.razorpayOAuthState = null;

        client.razorpayOAuthStateExpiry = null;

        await clientRepository.save(client);

        return {
            connected: true,
        };

    } catch (error: any) {

        const razorpayError =
            error.response?.data;

        console.error(
            "Razorpay OAuth Error:",
            razorpayError || error.message
        );

        const description =
            razorpayError?.error?.description;

        if (
            description ===
            "Authorization code has expired"
        ) {
            throw new Error(
                "Razorpay authorization code has expired. Please connect Razorpay again."
            );
        }

        throw new Error(
            description ||
            "Failed to connect Razorpay."
        );
    }
};


export const processWebhook = async (
    body: Buffer,
    signature: string
) => {
    // -----------------------------------------
    // Verify Razorpay webhook signature
    // -----------------------------------------

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

    // -----------------------------------------
    // Parse payload
    // -----------------------------------------

    let payload: any;

    try {
        payload = JSON.parse(body.toString());
    } catch {
        throw new Error("Invalid webhook payload.");
    }

    const event = payload.event;

    console.log("Razorpay webhook received:", event);

    // -----------------------------------------
    // Get Razorpay account ID
    // -----------------------------------------

    const accountId =
        payload.payload?.account?.entity?.id;

    if (!accountId) {
        console.warn(
            "Razorpay webhook account ID missing:",
            event
        );

        return true;
    }

    // -----------------------------------------
    // Find client
    // -----------------------------------------

    const client =
        await clientRepository.findOne({
            where: {
                razorpayLinkedAccountId: accountId,
            },
        });

    if (!client) {
        console.warn(
            `No client found for Razorpay account: ${accountId}`
        );

        return true;
    }

    // -----------------------------------------
    // Update account status
    // -----------------------------------------

    switch (event) {

        case "account.instantly_activated":

            client.razorpayAccountStatus =
                "ACTIVE";

            break;


        case "account.activated_kyc_pending":

            client.razorpayAccountStatus =
                "KYC_PENDING";

            break;


        default:

            console.log(
                "Unhandled Razorpay event:",
                event
            );

            return true;
    }

    await clientRepository.save(client);

    console.log(
        `Client ${client.clientId} Razorpay status updated to ${client.razorpayAccountStatus}`
    );

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
            razorpayConnected: true,
            razorpayLinkedAccountId: true,
            razorpayAccountStatus: true,
        },
    });

    if (!client) {
        throw new Error("Client not found.");
    }

    return {
        connected: client.razorpayConnected,
        accountId: client.razorpayLinkedAccountId ?? null,
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

export const getAccessTokenForMerchant = async (
    accountId: string
) => {
    const client = await clientRepository
        .createQueryBuilder("client")
        .addSelect([
            "client.razorpayLinkedAccountId",
            "client.razorpayAccessToken",
            "client.razorpayRefreshToken",
            "client.razorpayTokenType",
            "client.razorpayPublicToken",
            "client.razorpayAccessTokenExpiresAt",
        ])
        .where(
            "client.razorpayLinkedAccountId = :accountId",
            { accountId }
        )
        .getOne();

    if (!client) {
        throw new Error(
            "No client found for this Razorpay account."
        );
    }

    if (!client.razorpayConnected) {
        throw new Error(
            "Client is not connected to Razorpay."
        );
    }

    if (!client.razorpayAccessToken) {
        throw new Error(
            "Client has not completed Razorpay OAuth authorization."
        );
    }

    return client;
};


export const refreshRazorpayAccessToken = async (
    client: Client
) => {

    if (!client.razorpayRefreshToken) {
        throw new Error(
            "Razorpay refresh token not found."
        );
    }

    try {

        const response = await axios.post(
            "https://auth.razorpay.com/token",
            {
                client_id:
                    process.env.RAZORPAY_CLIENT_ID,

                client_secret:
                    process.env.RAZORPAY_CLIENT_SECRET,

                grant_type:
                    "refresh_token",

                refresh_token:
                    client.razorpayRefreshToken,
            },
            {
                headers: {
                    "Content-Type":
                        "application/json",
                },
            }
        );

        const token = response.data;

        // -----------------------------------------
        // Save NEW access token
        // -----------------------------------------

        client.razorpayAccessToken =
            token.access_token;

        // -----------------------------------------
        // IMPORTANT:
        // Razorpay returns a NEW refresh token.
        // -----------------------------------------

        if (token.refresh_token) {
            client.razorpayRefreshToken =
                token.refresh_token;
        }

        // -----------------------------------------
        // Save token type
        // -----------------------------------------

        if (token.token_type) {
            client.razorpayTokenType =
                token.token_type;
        }

        // -----------------------------------------
        // Save public token if returned
        // -----------------------------------------

        if (token.public_token) {
            client.razorpayPublicToken =
                token.public_token;
        }

        // -----------------------------------------
        // Calculate expiry
        // -----------------------------------------

        if (token.expires_in) {
            client.razorpayAccessTokenExpiresAt =
                new Date(
                    Date.now() +
                    Number(token.expires_in) * 1000
                );
        }

        client.razorpayConnected = true;

        await clientRepository.save(client);

        return client.razorpayAccessToken;

    } catch (error: any) {

        console.error(
            "Razorpay token refresh error:",
            error.response?.data ||
            error.message
        );

        throw new Error(
            error.response?.data?.error?.description ||
            "Failed to refresh Razorpay access token."
        );
    }
};



export const deleteSubMerchant = async (accountId: string) => {
    const client = await getAccessTokenForMerchant(accountId);

    try {
        const response = await axios.delete(
            `https://api.razorpay.com/v2/accounts/${accountId}`,
            {
                // headers: {
                //     Authorization: `Bearer ${client.razorpayAccessToken}`,
                // },
            }
        );
        return response.data;
    } catch (error: any) {
        // Access token expired — refresh and retry once
        if (error.response?.status === 401) {
            const newToken = await refreshRazorpayAccessToken(client);
            const retryResponse = await axios.delete(
                `https://api.razorpay.com/v2/accounts/${accountId}`,
                { headers: { Authorization: `Bearer ${newToken}` } }
            );
            return retryResponse.data;
        }
        console.log(error.response?.status);
        console.log(error.response?.data);
        throw error;
    }
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
            "order.subClient",
            "order.client"
        ],
    });

    if (!invoice) {
        throw new Error("Invoice not found.");
    }

    if (invoice.status === InvoiceStatus.PAID) {
        throw new Error("Invoice already paid.");
    }

    const clientId = invoice.order?.client?.clientId;

    if (!clientId) {
        throw new Error("Client not found.");
    }

    // -----------------------------------------
    // Load client + sensitive Razorpay fields
    // -----------------------------------------

    const client = await clientRepository
        .createQueryBuilder("client")
        .addSelect([
            "client.razorpayLinkedAccountId",
            "client.razorpayAccessToken",
            "client.razorpayAccessTokenExpiresAt",
        ])
        .where("client.clientId = :clientId", {
            clientId,
        })
        .getOne();

    if (!client) {
        throw new Error("Client not found.");
    }

    // -----------------------------------------
    // Razorpay connection validation
    // -----------------------------------------

    if (!client.razorpayConnected) {
        throw new Error(
            "Client Razorpay account is not connected."
        );
    }

    if (!client.razorpayAccessToken) {
        throw new Error(
            "Client Razorpay access token not found."
        );
    }

    if (!client.razorpayPublicToken) {
        throw new Error(
            "Client Razorpay public token not found."
        );
    }

    if (!client.razorpayLinkedAccountId) {
        throw new Error(
            "Client Razorpay account ID not found."
        );
    }

    // -----------------------------------------
    // Check account status
    // -----------------------------------------

    if (client.razorpayAccountStatus !== "ACTIVE") {
        throw new Error(
            "Client Razorpay account is not active."
        );
    }

    // -----------------------------------------
    // Check access-token expiry
    // -----------------------------------------

    if (
        client.razorpayAccessTokenExpiresAt &&
        client.razorpayAccessTokenExpiresAt <= new Date()
    ) {
        throw new Error(
            "Razorpay access token expired."
        );
    }

    // -----------------------------------------
    // Prevent duplicate pending transaction
    // -----------------------------------------

    const existingTransaction =
        await transactionRepository.findOne({
            where: {
                invoice: {
                    invoiceId,
                },
                status: TransactionStatus.PENDING,
            },
            relations: ["invoice"],
        });

    if (existingTransaction) {
        return {
            transactionId:
                existingTransaction.transactionId,

            invoiceId:
                invoice.invoiceId,

            invoiceNumber:
                invoice.invoiceNumber,

            razorpayOrderId:
                existingTransaction.razorpayOrderId,

            amount:
                Math.round(
                    Number(existingTransaction.amount) * 100
                ),

            currency:
                existingTransaction.currency,

            key:
                client.razorpayPublicToken,
        };
    }

    // -----------------------------------------
    // Validate amount
    // -----------------------------------------

    const amountInPaise = Math.round(
        Number(invoice.amount) * 100
    );

    if (
        !Number.isFinite(amountInPaise) ||
        amountInPaise <= 0
    ) {
        throw new Error("Invalid invoice amount.");
    }

    // -----------------------------------------
    // Create Razorpay Order
    // -----------------------------------------

    let razorpayOrder;

    try {
        const razorpayResponse = await axios.post(
            "https://api.razorpay.com/v1/orders",
            {
                amount: amountInPaise,
                currency: "INR",
                receipt: invoice.invoiceNumber,

                notes: {
                    invoiceId:
                        invoice.invoiceId.toString(),

                    clientId:
                        client.clientId.toString(),
                },
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${client.razorpayAccessToken}`,

                    "Content-Type":
                        "application/json",
                },
            }
        );

        razorpayOrder = razorpayResponse.data;

    } catch (error: any) {
        console.error(
            "Razorpay Order Creation Error:",
            error.response?.data || error.message
        );

        throw new Error(
            error.response?.data?.error?.description ||
            "Failed to create Razorpay order."
        );
    }

    // -----------------------------------------
    // Save Transaction
    // -----------------------------------------

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

    // -----------------------------------------
    // Return Checkout information
    // -----------------------------------------

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
            client.razorpayPublicToken,
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

    // -----------------------------------------
    // Verify that this is OUR Razorpay Order
    // -----------------------------------------

    if (
        transaction.razorpayOrderId !==
        razorpayOrderId
    ) {
        throw new Error(
            "Invalid Razorpay order ID."
        );
    }

    // -----------------------------------------
    // Verify Razorpay Payment Signature
    // -----------------------------------------

    const generatedSignature =
        crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_CLIENT_SECRET!
            )
            .update(
                `${transaction.razorpayOrderId}|${razorpayPaymentId}`
            )
            .digest("hex");

    if (
        !crypto.timingSafeEqual(
            Buffer.from(generatedSignature, "utf8"),
            Buffer.from(razorpaySignature, "utf8")
        )
    ) {
        throw new Error(
            "Invalid payment signature."
        );
    }

    // -----------------------------------------
    // Update transaction
    // -----------------------------------------

    transaction.razorpayPaymentId =
        razorpayPaymentId;

    transaction.razorpaySignature =
        razorpaySignature;

    transaction.status =
        TransactionStatus.SUCCESS;

    await transactionRepository.save(
        transaction
    );

    // -----------------------------------------
    // Update invoice
    // -----------------------------------------

    const invoice =
        transaction.invoice;

    invoice.status =
        InvoiceStatus.PAID;

    await invoiceRepository.save(
        invoice
    );

    // -----------------------------------------
    // Update order
    // -----------------------------------------

    const order =
        invoice.order;

    order.status =
        OrderStatus.PROCESSING;

    await orderRepository.save(
        order
    );

    // -----------------------------------------
    // Reduce stock
    // -----------------------------------------

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

    if (orderDetails) {
        for (
            const item of orderDetails.items
        ) {
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
