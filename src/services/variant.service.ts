import { AppDataSource } from "../database/data-source";
import { Color } from "../entities/Color";
import { Product } from "../entities/Product";
import { Size } from "../entities/Size";
import { User } from "../entities/User";
import { VariantImage } from "../entities/VariantImage";
import { Variant } from "../entities/Variants";
import { VariantTechnicalDetail } from "../entities/VariantTechnicalDetails";
import { WholesalePriceTier } from "../entities/WholesalePriceTiers";
import { Role } from "../utils/constants";

export const productRepository = AppDataSource.getRepository(Product);
export const variantRepository = AppDataSource.getRepository(Variant);
export const colorRepository = AppDataSource.getRepository(Color);
export const sizeRepository = AppDataSource.getRepository(Size);
export const userRepository = AppDataSource.getRepository(User);
export const variantImageRepository = AppDataSource.getRepository(VariantImage);
export const variantTechnicalDetailRepository = AppDataSource.getRepository(VariantTechnicalDetail);

export const createVariant = async (
    body: any,
    userId: number
) => {
    return await AppDataSource.transaction(async (manager) => {
        const {
            productId,
            colorId,
            sizeId,
            name,
            sku,
            price,
            discount_percentage = 0,
            stock,
            images = [],
            technicalDetails = [],
            wholesalePriceTiers = [],
        } = body;

        const user = await manager.findOne(User, {
            where: { userId },
            relations: ["client", "role"],
        });

        if (!user) {
            throw new Error("User not found.");
        }

        if (
            user.role.name !== Role.SUPER_ADMIN &&
            user.role.name !== Role.CLIENT
        ) {
            throw new Error("You are not authorized.");
        }

        const product = await manager.findOne(Product, {
            where: {
                productId,
            },
            relations: [
                "category",
                "category.client",
            ],
        });

        if (!product) {
            throw new Error("Product not found.");
        }

        if (
            user.role.name === Role.CLIENT &&
            product.category.client.clientId !== user.client.clientId
        ) {
            throw new Error("Unauthorized.");
        }

        const existingSku = await manager.findOne(Variant, {
            where: {
                sku,
            },
        });

        if (existingSku) {
            throw new Error("SKU already exists.");
        }

        const color = colorId
            ? await manager.findOne(Color, {
                where: { colorId },
            })
            : null;

        const size = sizeId
            ? await manager.findOne(Size, {
                where: { sizeId },
            })
            : null;

        const discounted_price =
            Number(price) -
            (Number(price) * Number(discount_percentage)) / 100;

        const variant = manager.create(Variant, {
            product,
            color,
            size,
            name,
            sku,
            price,
            discount_percentage,
            discounted_price,
            stock,
            created_by: userId,
        });

        const savedVariant = await manager.save(variant);

        if (technicalDetails.length) {
            for (const item of technicalDetails) {
                const variantTechnicalDetail = manager.create(
                    VariantTechnicalDetail,
                    {
                        variant: savedVariant,
                        key: item.key,
                        value: item.value,
                    }
                );

                await manager.save(variantTechnicalDetail);
            }
        }

        // ================= Variant Wholesale Price Tiers =================

        if (wholesalePriceTiers.length) {

            for (const tier of wholesalePriceTiers) {

                const wholesaleTier = manager.create(
                    WholesalePriceTier,
                    {
                        product,
                        variant: savedVariant,
                        min_quantity: tier.min_quantity,
                        price: tier.price,
                        created_by: userId,
                    }
                );

                await manager.save(wholesaleTier);
            }
        }

        // Create Variant Images
        if (images.length) {
            for (const item of images) {
                const variantImage = manager.create(VariantImage, {
                    variant: savedVariant,
                    image_url: item.image_url,
                    alt_text: item.alt_text,
                    is_thumbnail: item.is_thumbnail ?? false,
                    created_by: userId,
                });

                await manager.save(variantImage);
            }
        }

        return await manager.findOne(Variant, {
            where: {
                variantId: savedVariant.variantId,
            },
            relations: [
                "product",
                "color",
                "size",
                "variantImages",
                "technicalDetails",
                "wholesalePriceTiers",
            ],
        });
    });
};

export const getVariants = async (
    productId: number,
    userId: number
) => {
    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "role"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (!productId) {
        throw new Error("ProductId is required.");
    }

    if (user.role.name === Role.SUPER_ADMIN) {
        return await variantRepository.find({
            where: {
                product: {
                    productId,
                },
            },
            relations: [
                "product",
                "variantImages",
                "color",
                "size",
            ],
        });
    }

    return await variantRepository.find({
        where: {
            product: {
                productId,
                category: {
                    client: {
                        clientId: user.client.clientId,
                    },
                },
            },
        },
        relations: [
            "product",
            "product.category",
            "product.category.client",
            "variantImages",
            "color",
            "size",
        ],
    });
};

export const getVariantById = async (
    variantId: number,
    userId: number
) => {
    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "role"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    let variant;

    if (user.role.name === Role.SUPER_ADMIN) {
        variant = await variantRepository.findOne({
            where: { variantId },
            relations: [
                "product",
                "variantImages",
                "color",
                "size",
            ],
        });
    } else {
        variant = await variantRepository.findOne({
            where: {
                variantId,
                product: {
                    category: {
                        client: {
                            clientId: user.client.clientId,
                        },
                    },
                },
            },
            relations: [
                "product",
                "product.category",
                "product.category.client",
                "variantImages",
                "color",
                "size",
            ],
        });
    }

    if (!variant) {
        throw new Error("Variant not found.");
    }

    return variant;
};

export const updateVariant = async (
    variantId: number,
    body: any,
    userId: number
) => {
    return await AppDataSource.transaction(async (manager) => {

        const variant = await manager.findOne(Variant, {
            where: {
                variantId,
            },
            relations: [
                "product",
                "product.category",
                "product.category.client",
                "color",
                "size",
                "variantImages",
                "technicalDetails",
                "wholesalePriceTiers",
            ],
        });

        if (!variant) {
            throw new Error("Variant not found.");
        }

        const user = await manager.findOne(User, {
            where: {
                userId,
            },
            relations: ["client", "role"],
        });

        if (!user) {
            throw new Error("User not found.");
        }

        if (
            user.role.name !== Role.SUPER_ADMIN &&
            user.role.name !== Role.CLIENT
        ) {
            throw new Error("Unauthorized.");
        }

        if (
            user.role.name === Role.CLIENT &&
            variant.product.category.client.clientId !== user.client.clientId
        ) {
            throw new Error("Unauthorized.");
        }

        // ================= Color =================

        if (body.colorId) {
            const color = await manager.findOne(Color, {
                where: {
                    colorId: body.colorId,
                },
            });

            if (!color) {
                throw new Error("Color not found.");
            }

            variant.color = color;
        }

        // ================= Size =================

        if (body.sizeId) {
            const size = await manager.findOne(Size, {
                where: {
                    sizeId: body.sizeId,
                },
            });

            if (!size) {
                throw new Error("Size not found.");
            }

            variant.size = size;
        }

        // ================= SKU Check =================

        if (body.sku && body.sku !== variant.sku) {
            const existingSku = await manager.findOne(Variant, {
                where: {
                    sku: body.sku,
                },
            });

            if (existingSku) {
                throw new Error("SKU already exists.");
            }

            variant.sku = body.sku;
        }

        // ================= Update Variant =================

        variant.name = body.name ?? variant.name;
        variant.price = body.price ?? variant.price;
        variant.stock = body.stock ?? variant.stock;
        variant.discount_percentage =
            body.discount_percentage ??
            variant.discount_percentage;

        variant.discounted_price =
            Number(variant.price) -
            (Number(variant.price) *
                Number(variant.discount_percentage)) /
            100;

        variant.updated_by = userId;

        await manager.save(variant);

        // ================= Variant Technical Details =================

        if (body.technicalDetails) {
            await manager.delete(VariantTechnicalDetail, {
                variant: {
                    variantId: variant.variantId,
                },
            });

            for (const item of body.technicalDetails) {
                const technicalDetail =
                    manager.create(VariantTechnicalDetail, {
                        variant,
                        key: item.key,
                        value: item.value,
                    });

                await manager.save(technicalDetail);
            }
        }

        // ================= Variant Wholesale Price Tiers =================

        if (body.wholesalePriceTiers) {

            // Remove old tiers
            await manager.delete(WholesalePriceTier, {
                variant: {
                    variantId: variant.variantId,
                },
            });


            // Add new tiers
            for (const tier of body.wholesalePriceTiers) {

                const wholesaleTier =
                    manager.create(WholesalePriceTier, {
                        product: variant.product,
                        variant,
                        min_quantity: tier.min_quantity,
                        price: tier.price,
                        created_by: userId,
                    });

                await manager.save(wholesaleTier);
            }
        }

        // ================= Variant Images =================

        if (body.images) {

            // Remove old images
            await manager.delete(VariantImage, {
                variant: {
                    variantId: variant.variantId,
                },
            });

            // Add new images
            for (const item of body.images) {
                const image = manager.create(VariantImage, {
                    variant,
                    image_url: item.image_url,
                    alt_text: item.alt_text,
                    is_thumbnail: item.is_thumbnail ?? false,
                    created_by: userId,
                });

                await manager.save(image);
            }
        }

        // ================= Return Updated Variant =================

        return await manager.findOne(Variant, {
            where: {
                variantId: variant.variantId,
            },
            relations: [
                "product",
                "color",
                "size",
                "variantImages",
                "technicalDetails",
                "wholesalePriceTiers",
            ],
        });
    });
};

export const deleteVariant = async (
    variantId: number,
    userId: number
) => {

    const variant = await variantRepository.findOne({
        where: {
            variantId,
        },
        relations: [
            "product",
            "product.category",
            "product.category.client",
        ],
    });

    if (!variant) {
        throw new Error("Variant not found.");
    }

    // Logged-in user
    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: ["client", "role"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    // Client can delete only their own variants
    if (
        user.role.name === Role.CLIENT &&
        variant.product.category.client.clientId !== user.client.clientId
    ) {
        throw new Error("Unauthorized.");
    }

    variant.is_active = false;
    variant.updated_by = userId;

    await variantRepository.save(variant);

    return {
        status: true,
        message: "Variant deleted successfully.",
    };
};