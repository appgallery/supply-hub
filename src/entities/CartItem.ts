import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

import { Cart } from "./Cart";
import { Variant } from "./Variants";

@Entity("cart_items")
export class CartItem {

    @PrimaryGeneratedColumn()
    cartItemId: number;

    @ManyToOne(() => Cart, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "cart_id" })
    cart: Cart;

    @Column()
    cart_id: number;

    @ManyToOne(() => Variant)
    @JoinColumn({ name: "variant_id" })
    variant: Variant;

    @Column()
    variant_id: number;

    @Column({
        default: 1,
    })
    quantity: number;

    // Price at the time the item was added
    @Column({
        type: "decimal",
        precision: 12,
        scale: 2,
    })
    price: number;

    @Column({
        type: "decimal",
        precision: 5,
        scale: 2,
        default: 0,
    })
    discount_percentage: number;

    @Column({
        type: "decimal",
        precision: 12,
        scale: 2,
        default: 0,
    })
    discount_amount: number;

    // Price after discount (without tax/shipping)
    @Column({
        type: "decimal",
        precision: 12,
        scale: 2,
        default: 0,
    })
    discounted_amount: number;

    // Final item amount
    @Column({
        type: "decimal",
        precision: 12,
        scale: 2,
        default: 0,
    })
    amount: number;

    @CreateDateColumn()
    createdOn: Date;

    @UpdateDateColumn()
    modifiedOn: Date;
}