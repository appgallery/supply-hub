// src/entities/Color.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("colors")
export class Color {
  @PrimaryGeneratedColumn()
  colorId: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  hex_code: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}