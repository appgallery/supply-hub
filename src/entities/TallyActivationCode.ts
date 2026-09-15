import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm";

import { BaseEntity } from "./BaseEntity";
import { Client } from "./Client";

@Entity("tally_activation_codes")
export class TallyActivationCode extends BaseEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @Index()
    clientId: number;

    @ManyToOne(
        () => Client,
        (client) => client.tallyActivationCodes,
        {
            onDelete: "CASCADE",
        }
    )
    @JoinColumn({
        name: "clientId",
    })
    client: Client;

    @Column({
        unique: true,
    })
    activationCode: string;

    @Column({
        default: false,
    })
    used: boolean;

    @Column({
        nullable: true,
    })
    deviceId: number;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    usedAt: Date;
}