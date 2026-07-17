import {
    Entity,
    Column,
    OneToMany,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";

@Entity("roles")
export class Role {
    @PrimaryGeneratedColumn()
    roleId: number

    @Column({
        type: "varchar",
        length: 100,
        nullable: true,
    })
    name: string;

    @Column({
        type: "text",
        nullable: true,
    })
    description?: string;

    @OneToMany(() => User, (user) => user.role)
    users: User[];
}