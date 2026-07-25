import {
    Entity,
    PrimaryGeneratedColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

import { User } from "./User";
import { CartItem } from "./CartItem";

@Entity("carts")
export class Cart {

    @PrimaryGeneratedColumn()
    cartId: number;

    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column()
    user_id: number;

    @OneToMany(() => CartItem, cartItem => cartItem.cart, {
        cascade: true,
    })
    cartItems: CartItem[];

    @CreateDateColumn()
    createdOn: Date;

    @UpdateDateColumn()
    modifiedOn: Date;
}