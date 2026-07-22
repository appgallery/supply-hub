import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";

import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { Client } from "../entities/Client";
import { SubClient } from "../entities/SubClient";
import { RefreshToken } from "../entities/RefreshToken";
import { Product } from "../entities/Product";
import { Color } from "../entities/Color";
import { Size } from "../entities/Size";
import { Variant } from "../entities/Variants";
import { VariantImage } from "../entities/VariantImage";
import { ProductMedia } from "../entities/ProductMedia";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { ActivityLog } from "../entities/ActivityLog";

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
        Product,
        Color,
        Size,
        Variant,
        VariantImage,
        ProductMedia,
        Order,
        OrderItem,
        ActivityLog
    ],
});