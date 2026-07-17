import { Router } from "express";
import authRoutes from './auth.route'
import clientRoutes from './client.route'
import subClientRoutes from './subClient.route'
import roleRoutes from './role.route'

const router = Router();

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/subClients", subClientRoutes);
router.use("/role", roleRoutes);

export default router;