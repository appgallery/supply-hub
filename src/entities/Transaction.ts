import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { TransactionStatus } from "../utils/constants";
import { BaseEntity } from "./BaseEntity";
import { Invoice } from "./Invoice";

@Entity()
export class Transaction extends BaseEntity {

    @PrimaryGeneratedColumn()
    transactionId: number;

    @ManyToOne(() => Invoice, { nullable: true })
    @JoinColumn({ name: "invoiceId" })
    invoice: Invoice;

    @Column()
    razorpayOrderId: string;

    @Column({
        nullable: true
    })
    razorpayPaymentId: string;

    @Column({
        nullable: true
    })
    razorpaySignature: string;

    @Column()
    amount: number;

    @Column()
    currency: string;

    @Column({
        type: "enum",
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    status: TransactionStatus;

    @Column({
        default: "RAZORPAY"
    })
    gateway: string;

}