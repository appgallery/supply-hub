import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
} from "typeorm";

import { Product } from "./Product";
import { VariantImage } from "./VariantImage";
import { Color } from "./Color";
import { Size } from "./Size";

@Entity("variants")
export class Variant {
  @PrimaryGeneratedColumn()
  variantId: number;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "productId" })
  product: Product;

  @ManyToOne(() => Color, {
    eager: true,
    nullable: true,
  })
  color: Color | null;

  @ManyToOne(() => Size, {
    eager: true,
    nullable: true,
  })
  size: Size | null;

  @Column()
  name: string;

  @Column({ unique: true })
  sku: string;

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
  discount_percentage: number;

  @Column("decimal", {
    precision: 10,
    scale: 2,
    nullable: true,
  })
  discounted_price: number;

  @Column({ default: 0 })
  stock: number;

  @OneToMany(
    () => VariantImage,
    (variantImage) => variantImage.variant,
    {
      cascade: true,
    }
  )
  variantImages: VariantImage[];

  @Column()
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({
    default: true,
  })
  is_active: boolean;
}