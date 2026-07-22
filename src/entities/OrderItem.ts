import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";

import { Order } from "./Order";
import { Product } from "./Product";
import { Variant } from "./Variants";

@Entity("order_items")
export class OrderItem {
    @PrimaryGeneratedColumn()
    orderItemId: number;

    @ManyToOne(() => Order, (order) => order.items, {
        onDelete: "CASCADE",
    })
    order: Order;

    @ManyToOne(() => Variant)
    @JoinColumn({ name: "variantId" })
    variant: Variant;

    @Column()
    quantity: number;

    @Column("decimal", {
        precision: 10,
        scale: 2,
    })
    price: number;

    @Column("decimal", {
        precision: 10,
        scale: 2,
        default: 0,
    })
    discount: number;

    @Column("decimal", {
        precision: 12,
        scale: 2,
    })
    total: number;
}