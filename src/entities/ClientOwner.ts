import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Client } from "./Client";

@Entity("client_owners")
export class ClientOwner {

    @PrimaryGeneratedColumn()
    clientOwnerId: number;

    @ManyToOne(() => Client, client => client.owners)
    @JoinColumn({ name: "client_id" })
    client: Client;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    mobile: string;

    @Column({ nullable: true })
    designation: string;

    @Column({ nullable: true })
    panNumber: string;

    @Column({ nullable: true })
    aadhaarNumber: string;

    @Column({
        type: "date",
        nullable: true,
    })
    dob: Date;

    @Column({
        type: "boolean",
        default: true,
    })
    isActive: boolean;

    @CreateDateColumn()
    createdOn: Date;
}