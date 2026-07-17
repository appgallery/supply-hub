import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    PrimaryGeneratedColumn,
} from "typeorm";

import { BaseEntity } from "./BaseEntity";
import { User } from "./User";

@Entity("refresh_tokens")
export class RefreshToken extends BaseEntity {

    @PrimaryGeneratedColumn()
    refreshTokenId: number;

    @ManyToOne(() => User, (user) => user.refreshTokens, {
        onDelete: "CASCADE",
    })
    @JoinColumn({
        name: "user_id",
    })
    user: User;

    @Column({
        type: "text",
    })
    token: string;

    @Column({
        type: "timestamp",
    })
    expiresAt: Date;

    @Column({
         type: "boolean",
        default: false,
    })
    isRevoked: boolean;
}