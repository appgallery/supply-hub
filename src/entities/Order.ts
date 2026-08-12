import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from "typeorm";

import { Client } from "./Client";
import { SubClient } from "./SubClient";
import { OrderItem } from "./OrderItem";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../utils/constants";
import { User } from "./User";
import { Address } from "./Address";


@Entity("orders")
export class Order {
    @PrimaryGeneratedColumn()
    orderId: number;

    @Column({ nullable: true, unique: true })
    orderNumber: string;

    // Seller
    @ManyToOne(() => Client)
    @JoinColumn({ name: "clientId" })
    client: Client;

    // Buyer
    @ManyToOne(() => SubClient)
    @JoinColumn({ name: "subClientId" })
    subClient: SubClient;

    @Column({
        type: "enum",
        enum: OrderStatus,
        default: OrderStatus.PENDING,
    })
    status: OrderStatus;

    @Column({
        type: "enum",
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    payment_status: PaymentStatus;

    @Column("decimal", {
        precision: 12,
        scale: 2,
        default: 0,
    })
    subtotal: number;

    @Column("decimal", {
        precision: 12,
        scale: 2,
        default: 0,
    })
    totalDiscount: number;

    @Column("decimal", {
        precision: 12,
        scale: 2,
        default: 0,
    })
    discount: number;

    @Column("decimal", {
        precision: 12,
        scale: 2,
        default: 0,
    })
    tax: number;

    @Column("decimal", {
        precision: 12,
        scale: 2,
        default: 0,
    })
    totalAmount: number;

    @Column({
        nullable: true,
    })
    notes: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "approved_by" })
    approvedBy: User;

    @Column({ nullable: true })
    approved_at: Date;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "rejected_by" })
    rejectedBy: User;

    @Column({ nullable: true })
    rejected_at: Date;

    @Column({
        type: "text",
        nullable: true,
    })
    rejection_reason: string;

    @ManyToOne(() => Address)
    @JoinColumn({ name: "shippingAddressId" })
    shippingAddress: Address;

    @ManyToOne(() => Address)
    @JoinColumn({ name: "billingAddressId" })
    billingAddress: Address;

    @Column("decimal", {
        precision: 12,
        scale: 2,
        default: 0,
    })
    shipping_amount: number;

    @Column({
        type: "enum",
        enum: PaymentMethod,
        nullable: true,
    })
    payment_method: PaymentMethod;

    @OneToMany(() => OrderItem, (item) => item.order, {
        cascade: true,
    })
    items: OrderItem[];

    @Column()
    created_by: number;

    @Column({ nullable: true })
    updated_by: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}