import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from "typeorm";

@Entity("activity_logs")
export class ActivityLog {

    @PrimaryGeneratedColumn()
    activityLogId: number;

    @Column()
    title: string;

    @Column({
        nullable: true,
    })
    description: string;

    @Column()
    type: string;

    @Column({
        nullable: true,
    })
    clientId: number;

    @Column({
        nullable: true,
    })
    subClientId: number;

    @Column({
        nullable: true,
    })
    userId: number;

    @CreateDateColumn()
    created_at: Date;
}