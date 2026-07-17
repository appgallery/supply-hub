import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";

import { BaseEntity } from "./BaseEntity";
import { Client } from "./Client";
import { User } from "./User";

@Entity("sub_clients")
export class SubClient extends BaseEntity {
  @PrimaryGeneratedColumn()
  subClientId: number;

  @ManyToOne(() => Client, (client) => client.subClients, {
    onDelete: "CASCADE",
  })
  @JoinColumn()
  client: Client;

  @Column({
    nullable:true
  })
  companyName: string;

  @Column({
    nullable: true,
  })
  contactPerson: string;

  @Column({
    nullable: true,
  })
  email: string;

  @Column({
    nullable: true,
  })
  mobile: string;

  @Column({
    nullable: true,
  })
  gstNumber: string;

  @Column({
    nullable: true,
  })
  panNumber: string;

  @Column({
    nullable: true,
  })
  website: string;

  @Column({
    nullable: true,
  })
  address: string;

  @Column({
    nullable: true,
  })
  city: string;

  @Column({
    nullable: true,
  })
  state: string;

  @Column({
    nullable: true,
  })
  country: string;

  @Column({
    nullable: true,
  })
  postalCode: string;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
  })
  creditLimit: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
  })
  availableCredit: number;

  @OneToMany(() => User, (user) => user.subClient)
  users: User[];
}