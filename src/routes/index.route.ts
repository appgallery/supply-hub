import { Router } from "express";
import authRoutes from './auth.route'
import clientRoutes from './client.route'
import subClientRoutes from './subClient.route'
import roleRoutes from './role.route'
import productRoutes from './product.route'
import colorRoutes from './color.route'
import sizeRoutes from './size.route'
import VariantRoute from './variant.route'
import OrderRoute from './order.route'
import categoryRoute from './category.route'

const router = Router();

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/subClients", subClientRoutes);
router.use("/role", roleRoutes);
router.use("/product", productRoutes);
router.use("/color", colorRoutes);
router.use("/size", sizeRoutes);
router.use("/variant", VariantRoute);
router.use("/order", OrderRoute);
router.use("/category", categoryRoute);

export default router;