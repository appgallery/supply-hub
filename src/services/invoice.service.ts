import { Role } from "../utils/constants";
import { AppDataSource } from "../database/data-source";
import { Invoice } from "../entities/Invoice";
import { User } from "../entities/User";

export const invoiceRepository = AppDataSource.getRepository(Invoice);
export const userRepository = AppDataSource.getRepository(User);

export const getInvoices = async (
    invoiceId: number | undefined,
    userId: number,
    roleName: string
) => {
    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "subClient"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const where: any = {};

    if (roleName === Role.CLIENT) {
        where.order = {
            client: {
                clientId: user.client.clientId,
            },
        };
    }

    if (roleName === Role.SUB_CLIENT) {
        where.order = {
            subClient: {
                subClientId: user.subClient.subClientId,
            },
        };
    }

    if (invoiceId) {
        where.invoiceId = invoiceId;
    }

    const invoices = await invoiceRepository.find({
        where,
        relations: [
            "order",
            "order.client",
            "order.subClient",
        ],
        order: {
            invoiceId: "DESC",
        },
    });

    if (invoiceId && invoices.length === 0) {
        throw new Error("Invoice not found.");
    }

    const response = invoices.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        status: invoice.status,
        createdAt: invoice.created_at,
        order: {
            orderId: invoice.order.orderId,
            orderNumber: invoice.order.orderNumber,
        },
        client: {
            clientId: invoice.order.client.clientId,
            companyName: invoice.order.client.companyName,
        },
        subClient: {
            subClientId: invoice.order.subClient.subClientId,
            companyName: invoice.order.subClient.companyName,
        },
    }));

    return invoiceId ? response[0] : response;
};