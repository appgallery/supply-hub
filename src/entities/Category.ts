import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

import { Client } from "./Client";
import { Product } from "./Product";

@Entity("categories")
export class Category {

    @PrimaryGeneratedColumn()
    categoryId: number;

    @ManyToOne(() => Client, {
        nullable: false,
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "clientId" })
    client: Client;

    @Column({
        unique: true,
    })
    categoryCode: string;

    @Column()
    categoryName: string;

    @Column({
        nullable: true,
    })
    description: string;

    @Column({
        default: true,
    })
    isActive: boolean;

    @OneToMany(
        () => Product,
        product => product.category
    )
    products: Product[];

    @Column()
    createdBy: number;

    @Column({
        nullable: true,
    })
    updatedBy: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}