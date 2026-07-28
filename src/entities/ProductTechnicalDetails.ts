import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Product } from "./Product";


@Entity("product_technical_details")
export class ProductTechnicalDetail {
    @PrimaryGeneratedColumn()
    technicalDetailId: number;

    @ManyToOne(
        () => Product,
        product => product.technicalDetails,
        { onDelete: "CASCADE" }
    )
    @JoinColumn({ name: "productId" })
    product: Product;

    @Column()
    key: string;

    @Column("text")
    value: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}