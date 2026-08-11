import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { User } from "./User";
import { SubClient } from "./SubClient";
import { Product } from "./Product";
import { ClientOwner } from "./ClientOwner";
import { TaxType } from "../utils/constants";

@Entity("clients")
export class Client extends BaseEntity {
  @PrimaryGeneratedColumn()
  clientId: number;

  @Column({
    unique: true,
  })
  clientCode: string;

  @Column()
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
    type: "enum",
    enum: TaxType,
    default: TaxType.GST,
  })
  taxType: TaxType;

  @Column({
    type: "decimal",
    precision: 5,
    scale: 2,
    default: 18.00,
  })
  taxRate: number;

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
    nullable: true,
  })
  businessType: string;

  @Column({
    nullable: true,
  })
  registrationNumber: string;

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

  @Column({
    nullable: true,
  })
  razorpayLinkedAccountId: string;

  @Column({
    default: "PENDING"
  })
  razorpayAccountStatus: string;

  @Column({
    nullable: true,
  })
  razorpayOnboardingUrl: string;

  @OneToMany(() => User, (user) => user.client)
  users: User[];

  @OneToMany(() => SubClient, (subClient) => subClient.client)
  subClients: SubClient[];
  @OneToMany(
    () => ClientOwner,
    owner => owner.client,
    { cascade: true }
  )
  owners: ClientOwner[];

  @OneToMany(() => Product, (product) => product.client)
  products: Product[];
}