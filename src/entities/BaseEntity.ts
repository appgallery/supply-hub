import {
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { User } from "./User";

export abstract class BaseEntity {
    @ManyToOne(() => User)
    @JoinColumn()
    createdBy?: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "updated_by" })
    updatedBy?: User;

    @Column({
        type: "boolean",
        default: true,
    })
    isActive: boolean;

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: "timestamp",
    })
    updatedAt: Date;

    @DeleteDateColumn({
        type: "timestamp",
        nullable: true,
    })
    deletedAt?: Date;
}