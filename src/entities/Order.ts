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
import { OrderStatus } from "../utils/constants";


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