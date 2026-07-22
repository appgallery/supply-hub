import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { Product } from "./Product";
import { MediaType } from "../utils/constants";

@Entity("product_media")
export class ProductMedia {
  @PrimaryGeneratedColumn()
  mediaId: number;

  @ManyToOne(() => Product, (product) => product.media, {
    onDelete: "CASCADE",
  })
  product: Product;

  @Column()
  media_url: string;

  @Column({
    type: "enum",
    enum: MediaType,
  })
  media_type: MediaType;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: false })
  is_thumbnail: boolean;

  @Column({ nullable: true })
  alt_text: string;

  @Column({ nullable: true })
  video_thumbnail: string;

  @Column()
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}