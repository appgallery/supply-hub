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
import { SellerType } from "../utils/constants";
import { Client } from "./Client";

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn()
  productId: number;

  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "clientId" })
  client: Client;

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

  @OneToMany(() => Variant, (variant) => variant.product)
  variants: Variant[];

  @OneToMany(() => ProductMedia, (media) => media.product)
  media: ProductMedia[];

  @Column()
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}