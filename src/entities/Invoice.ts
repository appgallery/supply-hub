import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./Order";
import { InvoiceStatus } from "../utils/constants";
import { BaseEntity } from "./BaseEntity";

@Entity("invoices")
export class Invoice extends BaseEntity{
    @PrimaryGeneratedColumn()
    invoiceId: number;

    @Column({ unique: true })
    invoiceNumber: string;

    @OneToOne(() => Order)
    @JoinColumn()
    order: Order;

    @Column("decimal", {
        precision: 10,
        scale: 2,
    })
    amount: number;

    @Column({
        default: InvoiceStatus.UNPAID,
    })
    status: InvoiceStatus;

    @Column({
        nullable: true,
    })
    paymentReference: string;

    @CreateDateColumn()
    created_at: Date;
}