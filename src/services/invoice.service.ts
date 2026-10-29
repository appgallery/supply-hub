import { Role } from "../utils/constants";
import { AppDataSource } from "../database/data-source";
import { Invoice } from "../entities/Invoice";
import { User } from "../entities/User";

export const invoiceRepository = AppDataSource.getRepository(Invoice);
export const userRepository = AppDataSource.getRepository(User);

export const getInvoices = async (
    invoiceId: number | undefined,
    userId: number,
    roleName: string,
    filters?: {
        paymentStatus?: string;
        orderStatus?: string;
        offset?: number;
        limit?: number;
        searchTerm?: string;
    }
) => {
    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "subClient"],
    });

    if (!user) {
        throw new Error("User not found.");
    }


    const {
        paymentStatus,
        orderStatus,
        offset = 0,
        limit = 10,
        searchTerm,
    } = filters || {};


    const query = invoiceRepository
        .createQueryBuilder("invoice")
        .leftJoinAndSelect(
            "invoice.order",
            "order"
        )
        .leftJoinAndSelect(
            "order.client",
            "client"
        )
        .leftJoinAndSelect(
            "order.subClient",
            "subClient"
        )
        .leftJoinAndSelect(
            "order.items",
            "items"
        )
        .leftJoinAndSelect(
            "items.variant",
            "variant"
        )
        .leftJoinAndSelect(
            "variant.product",
            "product"
        )
        .leftJoinAndSelect(
            "variant.variantImages",
            "variantImages"
        );



    // Role based filter

    if (roleName === Role.CLIENT) {
        if (!user.client) {
            throw new Error("Client not found for this user.");
        }

        query.andWhere(
            "client.clientId = :clientId",
            {
                clientId: user.client.clientId
            }
        );

    }
    else if (roleName === Role.SUB_CLIENT) {

        if (!user.subClient) {
            throw new Error("Dealer not found for this user.");
        }

        query.andWhere(
            "subClient.subClientId = :subClientId",
            {
                subClientId: user.subClient.subClientId
            }
        );
    }
    else {
        throw new Error(
            "You are not authorized to access invoices."
        );
    }

    // Invoice ID filter
    if (invoiceId) {
        query.andWhere(
            "invoice.invoiceId = :invoiceId",
            {
                invoiceId,
            }
        );
    }

    // Order status filter
    if (orderStatus) {
        query.andWhere(
            "order.status = :orderStatus",
            {
                orderStatus,
            }
        );
    }

    // Search filter
    if (searchTerm) {
        query.andWhere(
            `(
            invoice.invoiceNumber ILIKE :searchTerm
            OR subClient.companyName ILIKE :searchTerm
        )`,
            {
                searchTerm: `%${searchTerm}%`,
            }
        );
    }

    /**
     * Counts should ignore paymentStatus filter
     */
    const countQuery = query.clone();

    const totalInvoices = await countQuery
        .clone()
        .getCount();

    const paidInvoices = await countQuery
        .clone()
        .andWhere(
            "invoice.status = :paidStatus",
            {
                paidStatus: "PAID",
            }
        )
        .getCount();

    const pendingInvoices = await countQuery
        .clone()
        .andWhere(
            "invoice.status = :pendingStatus",
            {
                pendingStatus: "UNPAID",
            }
        )
        .getCount();

    /**
     * Apply payment status filter only for list data
     */
    if (paymentStatus) {
        query.andWhere(
            "invoice.status = :paymentStatus",
            {
                paymentStatus,
            }
        );
    }

    query.orderBy(
        "invoice.invoiceId",
        "DESC"
    );

    query.skip(offset);
    query.take(limit);

    const [invoices, total] =
        await query.getManyAndCount();

    if (invoiceId && invoices.length === 0) {
        throw new Error("Invoice not found.");
    }

    const response = invoices.map((invoice) => ({
        ...invoice,
        amount: Number(invoice.amount),
    }));

    return {
        total, // filtered count (after paymentStatus filter)
        offset,
        limit,
        counts: {
            totalInvoices,
            paidInvoices,
            pendingInvoices,
        },
        data: invoiceId ? response[0] : response,
    };
};