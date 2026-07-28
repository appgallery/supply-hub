import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Variant } from "./Variants";

@Entity("variant_technical_details")
export class VariantTechnicalDetail {
    @PrimaryGeneratedColumn()
    technicalDetailId: number;

    @ManyToOne(() => Variant, variant => variant.technicalDetails, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "variantId" })
    variant: Variant;

    @Column()
    key: string;

    @Column("text")
    value: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}