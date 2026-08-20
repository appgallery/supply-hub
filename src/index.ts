
import "reflect-metadata";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import apiRoutes from "./routes/index.route"
import { AppDataSource } from "./database/data-source";

dotenv.config();


const app = express();

app.use(
    cors({
        origin: "*"
        // credentials: true
    })
);
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
// Razorpay webhook raw body
app.use(
    "/api/client/webhook/razorpay-account-update",
    express.raw({
        type: "application/json",
    })
);

// Other APIs JSON parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRoutes);

const PORT = process.env.PORT;

AppDataSource.initialize()
    .then(() => {
        console.log("✅ Database Connected");

        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

        console.log(server.listening);

    })
    .catch((error) => {
        console.error("❌ Database Connection Failed");
        console.error(error);
    });
