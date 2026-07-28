import { AppDataSource } from "../database/data-source";
import { Color } from "../entities/Color";
import { Product } from "../entities/Product";
import { Size } from "../entities/Size";
import { User } from "../entities/User";
import { VariantImage } from "../entities/VariantImage";
import { Variant } from "../entities/Variants";
import { Role } from "../utils/constants";

export const productRepository = AppDataSource.getRepository(Product);
export const variantRepository = AppDataSource.getRepository(Variant);
export const colorRepository = AppDataSource.getRepository(Color);
export const sizeRepository = AppDataSource.getRepository(Size);
export const userRepository = AppDataSource.getRepository(User);
export const variantImageRepository = AppDataSource.getRepository(VariantImage)

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

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: ["client", "role"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (
        user.role.name === Role.CLIENT &&
        variant.product.category.client.clientId !== user.client.clientId
    ) {
        throw new Error("Unauthorized.");
    }

    if (body.colorId) {
        variant.color = await colorRepository.findOne({
            where: {
                colorId: body.colorId,
            },
        });
    }

    if (body.sizeId) {
        variant.size = await sizeRepository.findOne({
            where: {
                sizeId: body.sizeId,
            },
        });
    }

    Object.assign(variant, body);

    variant.discounted_price =
        Number(variant.price) -
        (Number(variant.price) *
            Number(variant.discount_percentage)) /
        100;

    variant.updated_by = userId;

    await variantRepository.save(variant);

    if (body.images?.length) {
        for (const item of body.images) {
            if (item.variantImageId) {
                // Update existing image
                const existingImage = await variantImageRepository.findOne({
                    where: {
                        variantImageId: item.variantImageId,
                        variant: {
                            variantId: variant.variantId,
                        },
                    },
                    relations: ["variant"],
                });

                if (!existingImage) {
                    throw new Error(
                        `Variant image ${item.variantImageId} not found.`
                    );
                }

                existingImage.image_url =
                    item.image_url ?? existingImage.image_url;
                existingImage.alt_text =
                    item.alt_text ?? existingImage.alt_text;
                existingImage.is_thumbnail =
                    item.is_thumbnail ?? existingImage.is_thumbnail;
                existingImage.updated_by = userId;

                await variantImageRepository.save(existingImage);
            } else {
                // Create new image
                const newImage = variantImageRepository.create({
                    variant,
                    image_url: item.image_url,
                    alt_text: item.alt_text,
                    is_thumbnail: item.is_thumbnail ?? false,
                    created_by: userId,
                });

                await variantImageRepository.save(newImage);
            }
        }
    }

    return variant;
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