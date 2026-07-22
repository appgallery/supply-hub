import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { Variant } from "./Variants";

@Entity("variant_images")
export class VariantImage {
  @PrimaryGeneratedColumn()
  variantImageId: number;

  @ManyToOne(
    () => Variant,
    (variant) => variant.variantImages,
    {
      onDelete: "CASCADE",
    }
  )
  variant: Variant;

  @Column()
  image_url: string;

  @Column({ nullable: true })
  alt_text: string;

  @Column({ default: false })
  is_thumbnail: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column()
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}