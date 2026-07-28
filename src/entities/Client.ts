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