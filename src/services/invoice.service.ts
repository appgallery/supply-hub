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
            "order.items",
            "order.billingAddress",
            "order.items.variant",
            "order.items.variant.product",
            "order.items.variant.variantImages",
        ],
        order: {
            invoiceId: "DESC",
        },
    });

    if (invoiceId && invoices.length === 0) {
        throw new Error("Invoice not found.");
    }

    const response = invoices.map((invoice) => ({
        ...invoice,
        amount: Number(invoice.amount),
    }));

    return invoiceId ? response[0] : response;
};