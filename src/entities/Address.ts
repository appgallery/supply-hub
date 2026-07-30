import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

import { SubClient } from "./SubClient";
import { AddressType } from "../utils/constants";

@Entity("addresses")
export class Address {

    @PrimaryGeneratedColumn()
    addressId: number;

    @ManyToOne(() => SubClient, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "subClientId" })
    subClient: SubClient;

    @Column()
    subClientId: number;

    @Column({
        type: "enum",
        enum: AddressType,
    })
    addressType: AddressType;

    @Column()
    contactPerson: string;

    @Column()
    mobileNumber: string;

    @Column()
    addressLine1: string;

    @Column({
        nullable: true,
    })
    addressLine2: string;

    @Column()
    city: string;

    @Column()
    state: string;

    @Column()
    country: string;

    @Column()
    postalCode: string;

    @Column({
        default: false,
    })
    isDefault: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}