import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";

import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { Client } from "../entities/Client";
import { SubClient } from "../entities/SubClient";
import { RefreshToken } from "../entities/RefreshToken";

dotenv.config();
console.log({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
});
export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,

    synchronize: true, // Change to false in production
    logging: false,

    entities: [
        User,
        Role,
        Client,
        SubClient,
        RefreshToken,
    ],
});