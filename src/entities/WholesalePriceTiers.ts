import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Product } from "./Product";
import { Variant } from "./Variants";

@Entity("wholesale_price_tiers")
export class WholesalePriceTier {

    @PrimaryGeneratedColumn()
    tierId: number;

    @ManyToOne(() => Product, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "productId" })
    product: Product;

    @ManyToOne(() => Variant, {
        nullable: true,
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "variantId" })
    variant: Variant | null;

    @Column()
    min_quantity: number;

    @Column("decimal", {
        precision: 10,
        scale: 2,
    })
    price: number;
}