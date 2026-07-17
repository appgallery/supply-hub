import {
    Entity,
    Column,
    OneToMany,
    ManyToOne,
    JoinColumn,
    PrimaryGeneratedColumn,
} from "typeorm";
import { Role } from "./Role";
import { RefreshToken } from "./RefreshToken";
import { BaseEntity } from "./BaseEntity";
import { Client } from "./Client";
import { SubClient } from "./SubClient";

@Entity("users")
export class User extends BaseEntity {

    @PrimaryGeneratedColumn()
    userId: number;

    @Column({
        length: 100,
    })
    firstName: string;

    @Column({
        length: 100,
    })
    lastName: string;

    @Column({
        unique: true,
    })
    email: string;

    @Column({
        unique: true,
    })
    mobile: string;

    @Column()
    password: string;

    @ManyToOne(() => Role, (role) => role.users)
    @JoinColumn({
        name: "role_id",
    })
    role: Role;

    @OneToMany(() => RefreshToken, (token) => token.user)
    refreshTokens: RefreshToken[];

    @ManyToOne(() => Client, (client) => client.users, {
        nullable: true,
    })
    @JoinColumn({
        name: "client_id",
    })
    client: Client;

    @ManyToOne(() => SubClient, (subClient) => subClient.users, {
        nullable: true,
    })
    @JoinColumn({
        name: "sub_client_id",
    })
    subClient: SubClient;

    @Column({
        nullable: true,
        length: 6,
    })
    otp: string;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    otpExpiry: Date;

        @Column({
        type: "boolean",
        default: true,
    })
    isTemporaryPassword: boolean;
}