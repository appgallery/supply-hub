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

import { Variant } from "./Variants";
import { ProductMedia } from "./ProductMedia";
import { Category } from "./Category";
import { Client } from "./Client";
import { ProductTechnicalDetail } from "./ProductTechnicalDetails";
import { WholesalePriceTier } from "./WholesalePriceTiers";

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn()
  productId: number;

  @Column({
    unique: true,
  })
  productCode: string;

  @Column()
  productName: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column("decimal", {
    precision: 10,
    scale: 2,
  })
  base_price: number;

  @Column("decimal", {
    precision: 10,
    scale: 2,
    default: 0,
  })
  discount_percentage: number;

  @Column("decimal", {
    precision: 10,
    scale: 2,
    nullable: true,
  })
  discounted_price: number;
  @Column({ default: "AUD" })
  currency: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({
    nullable: true,
  })
  unit_text: string;

  @OneToMany(() => Variant, (variant) => variant.product)
  variants: Variant[];

  @ManyToOne(() => Client, (client) => client.products, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "clientId" })
  client: Client;

  @OneToMany(() => ProductMedia, (media) => media.product)
  media: ProductMedia[];

  @ManyToOne(() => Category, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "categoryId" })
  category: Category;

  @OneToMany(
    () => ProductTechnicalDetail,
    detail => detail.product,
    { cascade: true }
  )
  technicalDetails: ProductTechnicalDetail[];

  @OneToMany(
    () => WholesalePriceTier,
    tier => tier.product,
    {
      cascade: true,
    }
  )
  wholesalePriceTiers: WholesalePriceTier[];

  @Column()
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}