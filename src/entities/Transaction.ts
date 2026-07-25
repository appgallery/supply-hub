import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Order } from "./Order";

export enum TransactionType {
    SALE = "SALE",
    REFUND = "REFUND",
}

export enum TransactionStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
}

export enum PaymentGateway {
    RAZORPAY = "RAZORPAY",
    CASH = "CASH",
    BANK_TRANSFER = "BANK_TRANSFER",
}

@Entity("transactions")
export class Transaction {

    @PrimaryGeneratedColumn()
    transactionId: number;

    @ManyToOne(() => Order, {
        nullable: true,
        onDelete: "SET NULL",
    })
    @JoinColumn({ name: "order_id" })
    order: Order;

    @Column({
        nullable: true,
    })
    order_id: number;

    @Column({
        type: "enum",
        enum: TransactionType,
    })
    transaction_type: TransactionType;

    @Column({
        type: "enum",
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    transaction_status: TransactionStatus;

    @Column({
        type: "enum",
        enum: PaymentGateway,
    })
    payment_gateway: PaymentGateway;

    @Column({
        length: 10,
        default: "INR",
    })
    currency: string;

    // Amount in Rupees (e.g. 1500.50)
    @Column({
        type: "decimal",
        precision: 12,
        scale: 2,
    })
    amount: number;

    // Razorpay Order ID
    @Column({
        nullable: true,
    })
    gateway_order_id: string;

    // Razorpay Payment ID
    @Column({
        nullable: true,
    })
    gateway_payment_id: string;

    // Razorpay Signature
    @Column({
        nullable: true,
    })
    gateway_signature: string;

    // Receipt number
    @Column({
        nullable: true,
    })
    receipt: string;

    // Refund ID (if refunded)
    @Column({
        nullable: true,
    })
    refund_id: string;

    // Raw gateway response
    @Column({
        type: "json",
        nullable: true,
    })
    gateway_response: any;

    @Column({
        nullable: true,
    })
    failure_reason: string;

    @Column({
        nullable: true,
    })
    payment_method: string;

    @CreateDateColumn()
    createdOn: Date;

    @UpdateDateColumn()
    modifiedOn: Date;
}