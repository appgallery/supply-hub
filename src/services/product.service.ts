import { MoreThanOrEqual } from "typeorm";
import { Color } from "../entities/Color";
import { Product } from "../entities/Product";
import { ProductMedia } from "../entities/ProductMedia";
import { Size } from "../entities/Size";
import { AppDataSource } from "../database/data-source";
import { User } from "../entities/User";
import { ActivityType, Role, SellerType } from "../utils/constants";
import { appendFile } from "node:fs";
import { Client } from "../entities/Client";
import { VariantImage } from "../entities/VariantImage";
import { Variant } from "../entities/Variants";
import { createActivity } from "../utils/helper";
import { Category } from "../entities/Category";
import { ProductTechnicalDetail } from "../entities/ProductTechnicalDetails";
import { VariantTechnicalDetail } from "../entities/VariantTechnicalDetails";
import { WholesalePriceTier } from "../entities/WholesalePriceTiers";

const productRepository = AppDataSource.getRepository(Product);
const userRepository = AppDataSource.getRepository(User);
const clientRepository = AppDataSource.getRepository(Client);
const categoryRepository = AppDataSource.getRepository(Category);
const productTechnicalDetailRepository = AppDataSource.getRepository(ProductTechnicalDetail);

export const createProduct = async (
    body: any,
    userId: number
) => {
    return await AppDataSource.transaction(async (manager) => {
        const {
            productName,
            description,
            base_price,
            discount_percentage = 0,
            currency = "AUD",
            categoryId,
            media = [],
            technicalDetails = [],
            wholesalePriceTiers = [],
            variants = [],
        } = body;

        const user = await manager.findOne(User, {
            where: { userId },
            relations: ["client", "role"],
        });

        if (!user) {
            throw new Error("User not found.");
        }

        const category = await manager.findOne(Category, {
            where: {
                categoryId,
            },
            relations: ["client"],
        });

        if (!category) {
            throw new Error("Category not found.");
        }

        const client = category.client;

        if (user.role.name === Role.SUPER_ADMIN) {
            if (!category.client) {
                throw new Error("Invalid category.");
            }
        } else {
            if (category.client.clientId !== user.client.clientId) {
                throw new Error("You are not allowed to use this category.");
            }
        }

        const duplicate = await manager.findOne(Product, {
            where: {
                productName,
                category: {
                    categoryId,
                },
            },
            relations: ["category"],
        });
        if (duplicate) {
            throw new Error("Product already exists.");
        }

        const discounted_price =
            Number(base_price) -
            (Number(base_price) * Number(discount_percentage)) / 100;
        const productCode = await generateProductCode();

        const product = manager.create(Product, {
            productCode,
            productName,
            description,
            base_price,
            discount_percentage,
            discounted_price,
            currency,
            category,
            client,
            created_by: user.userId,
        });

        const savedProduct = await manager.save(product);

        const fullName = `${user.firstName} ${user.lastName}`;

        await createActivity(
            `New Product "${product.productName}" has been added by ${fullName}.`,
            ActivityType.PRODUCT_CREATED,
            client.clientId,
            undefined,
            user.userId
        );
        // ================= Product Images =================

        for (const item of media) {
            const productMedia = manager.create(ProductMedia, {
                product: savedProduct,
                media_url: item.media_url,
                media_type: item.media_type,
                created_by: user.userId
            });

            await manager.save(productMedia);
        }

        if (technicalDetails?.length) {
            for (const detail of technicalDetails) {
                const productTechnicalDetail = manager.create(ProductTechnicalDetail, {
                    product: savedProduct,
                    key: detail.key,
                    value: detail.value,
                });

                await manager.save(productTechnicalDetail);
            }
        }

        if (technicalDetails?.length) {
            for (const detail of technicalDetails) {
                const productTechnicalDetail = manager.create(ProductTechnicalDetail, {
                    product: savedProduct,
                    key: detail.key,
                    value: detail.value,
                });

                await manager.save(productTechnicalDetail);
            }
        }

        // ================= Variants =================

        for (const item of variants) {
            const existingSku = await manager.findOne(Variant, {
                where: {
                    sku: item.sku,
                },
            });

            if (existingSku) {
                throw new Error(`SKU ${item.sku} already exists.`);
            }

            let color = null;
            let size = null;

            if (item.colorId) {
                color = await manager.findOne(Color, {
                    where: {
                        colorId: item.colorId,
                    },
                });
            }

            if (item.sizeId) {
                size = await manager.findOne(Size, {
                    where: {
                        sizeId: item.sizeId,
                    },
                });
            }

            const variantDiscountedPrice =
                Number(item.price) -
                (Number(item.price) *
                    Number(item.discount_percentage || 0)) /
                100;

            const variant = manager.create(Variant, {
                product: savedProduct,
                name: item.name,
                sku: item.sku,
                price: item.price,
                discount_percentage: item.discount_percentage || 0,
                discounted_price: variantDiscountedPrice,
                stock: item.stock,
                color,
                size,
                created_by: user.userId,
            });

            const savedVariant = await manager.save(variant);

            if (item.technicalDetails?.length) {
                for (const detail of item.technicalDetails) {
                    const variantTechnicalDetail = manager.create(VariantTechnicalDetail, {
                        variant: savedVariant,
                        key: detail.key,
                        value: detail.value,
                    });

                    await manager.save(variantTechnicalDetail);
                }
            }

            // ================= Variant Wholesale Price Tiers =================

            if (item.wholesalePriceTiers?.length) {

                for (const tier of item.wholesalePriceTiers) {

                    const wholesaleTier = manager.create(
                        WholesalePriceTier,
                        {
                            product: savedProduct,
                            variant: savedVariant,
                            min_quantity: tier.min_quantity,
                            price: tier.price,
                            created_by: user.userId,
                        }
                    );

                    await manager.save(wholesaleTier);
                }
            }

            // ============== Variant Images ==============

            if (item.images?.length) {
                for (const image of item.images) {
                    const variantImage = manager.create(VariantImage, {
                        variant: savedVariant,
                        image_url: image.image_url,
                        created_by: user.userId
                    });

                    await manager.save(variantImage);
                }
            }
        }

        return await manager.findOne(Product, {
            where: {
                productId: savedProduct.productId,
            },
            relations: [
                "category",
                "category.client",
                "media",
                "technicalDetails",
                "wholesalePriceTiers",
                "variants",
                "variants.variantImages",
                "variants.color",
                "variants.size",
                "variants.technicalDetails",
                "variants.wholesalePriceTiers",
            ],
        });
    });
};

export const generateProductCode = async () => {
    const lastProduct = await productRepository.find({
        order: {
            productId: "DESC",
        },
        take: 1,
    });
    const product = lastProduct[0];
    if (!product) {
        return "PRD000001";
    }

    const lastNumber = Number(product.productCode.replace("PRD", ""));

    return `PRD${String(lastNumber + 1).padStart(6, "0")}`;
}

export const getProducts = async (
    userId: number,
    categoryId?: number,
    search?: string,
    sortBy:
        | "productId"
        | "name"
        | "createdAt"
        | "price_low"
        | "price_high"
        | "most_sold" = "productId",
    sortOrder: "ASC" | "DESC" = "DESC",
    offset: number = 0,
    limit: number = 10
) => {
    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "role"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const query = productRepository
        .createQueryBuilder("product")
        .leftJoinAndSelect("product.category", "category")
        .leftJoinAndSelect("category.client", "client")

        // Product details
        .leftJoinAndSelect(
            "product.technicalDetails",
            "productTechnicalDetails"
        )
        .leftJoinAndSelect(
            "product.wholesalePriceTiers",
            "productWholesalePriceTiers"
        )

        // Variants
        .leftJoinAndSelect(
            "product.variants",
            "variants"
        )
        .leftJoinAndSelect(
            "variants.color",
            "color"
        )
        .leftJoinAndSelect(
            "variants.size",
            "size"
        )
        .leftJoinAndSelect(
            "variants.variantImages",
            "variantImages"
        )
        .leftJoinAndSelect(
            "variants.technicalDetails",
            "variantTechnicalDetails"
        )
        .leftJoinAndSelect(
            "variants.wholesalePriceTiers",
            "variantWholesalePriceTiers"
        )

        // Product media
        .leftJoinAndSelect(
            "product.media",
            "media"
        )

        .where("product.is_active = :active", {
            active: true,
        });

    // Client wise products
    if (user.role.name !== Role.SUPER_ADMIN) {
        query.andWhere(
            "client.clientId = :clientId",
            {
                clientId: user.client.clientId,
            }
        );
    }

    // Category filter
    if (categoryId) {
        query.andWhere(
            "category.categoryId = :categoryId",
            {
                categoryId,
            }
        );
    }

    // Search
    if (search) {
        query.andWhere(
            "category.categoryName ILIKE :search",
            {
                search: `%${search}%`,
            }
        );
    }
    // Sorting
    switch (sortBy) {
        case "name":
            query.orderBy(
                "product.productName",
                sortOrder
            );
            break;

        case "createdAt":
            query.orderBy(
                "product.created_at",
                sortOrder
            );
            break;

        case "price_low":
            query.orderBy(
                "product.base_price",
                "ASC"
            );
            break;

        case "price_high":
            query.orderBy(
                "product.base_price",
                "DESC"
            );
            break;

        default:
            query.orderBy(
                "product.productId",
                sortOrder
            );
    }

    const [products, total] = await query
        .skip(offset)
        .take(limit)
        .getManyAndCount();

    return {
        products,
        total,
        offset,
        limit,
    };
};

export const getProductById = async (
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

    let product;

    if (user.role.name === Role.SUPER_ADMIN) {
        product = await productRepository.findOne({
            where: { productId, is_active: true },
            relations: ["client", "variants", "media"],
        });
    } else {
        product = await productRepository.findOne({
            where: {
                productId,
                category: {
                    client: {
                        clientId: user.client.clientId,
                    },
                },
                is_active: true,
            },
            relations: [
                "category",
                "category.client",
                "variants",
                "media"
            ]
        });
    }

    if (!product) {
        throw new Error("Product not found.");
    }

    return product;
};

export const getDealerProducts = async (
    userId: number,
    offset: number = 0,
    limit: number = 10
) => {
    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "role"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (!user.client) {
        throw new Error("Client not assigned to this dealer.");
    }

    const [products, total] = await productRepository.findAndCount({
        where: {
            client: {
                clientId: user.client.clientId,
            },
            is_active: true,
        },
        relations: [
            "client",
            "category",
            "variants",
            "media",
        ],
        order: {
            productId: "DESC",
        },
        skip: offset,
        take: limit,
    });

    return {
        products,
        total,
        offset,
        limit,
    };
};

export const updateProduct = async (
    productId: number,
    body: any,
    userId: number
) => {
    return await AppDataSource.transaction(async (manager) => {
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

        let product: Product | null;

        if (user.role.name === Role.SUPER_ADMIN) {
            product = await manager.findOne(Product, {
                where: { productId },
                relations: [
                    "category",
                    "client",
                    "media",
                    "technicalDetails",
                    "wholesalePriceTiers",
                    "variants",
                    "variants.variantImages",
                    "variants.technicalDetails",
                    "variants.color",
                    "variants.size",
                    "variants.wholesalePriceTiers",
                ],
            });
        } else {
            product = await manager.findOne(Product, {
                where: {
                    productId,
                    category: {
                        client: {
                            clientId: user.client.clientId,
                        },
                    },
                },
                relations: [
                    "category",
                    "client",
                    "media",
                    "technicalDetails",
                    "variants",
                    "variants.variantImages",
                    "variants.technicalDetails",
                    "variants.color",
                    "variants.size",
                ],
            });
        }

        if (!product) {
            throw new Error("Product not found.");
        }

        // Category
        if (body.categoryId) {
            const category = await manager.findOne(Category, {
                where: {
                    categoryId: body.categoryId,
                },
                relations: ["client"],
            });

            if (!category) {
                throw new Error("Category not found.");
            }

            product.category = category;
            product.client = category.client;
        }

        // Product fields
        product.productName =
            body.productName ?? product.productName;

        product.description =
            body.description ?? product.description;

        product.base_price =
            body.base_price ?? product.base_price;

        product.discount_percentage =
            body.discount_percentage ??
            product.discount_percentage;

        product.currency =
            body.currency ?? product.currency;

        product.discounted_price =
            Number(product.base_price) -
            (Number(product.base_price) *
                Number(product.discount_percentage)) /
            100;

        product.updated_by = user.userId;

        await manager.save(product);

        // ================= Product Images =================

        if (body.media) {
            await manager.delete(ProductMedia, {
                product: {
                    productId: product.productId,
                },
            });

            for (const item of body.media) {
                const media = manager.create(ProductMedia, {
                    product,
                    media_url: item.media_url,
                    media_type: item.media_type,
                    created_by: user.userId,
                });

                await manager.save(media);
            }
        }

        // ================= Product Technical Details =================

        if (body.technicalDetails) {
            await manager.delete(ProductTechnicalDetail, {
                product: {
                    productId: product.productId,
                },
            });

            for (const detail of body.technicalDetails) {
                const technicalDetail =
                    manager.create(ProductTechnicalDetail, {
                        product,
                        key: detail.key,
                        value: detail.value,
                    });

                await manager.save(technicalDetail);
            }
        }

        // ================= Product Wholesale Price Tiers =================

        if (body.wholesalePriceTiers) {

            await manager.delete(WholesalePriceTier, {
                product: {
                    productId: product.productId,
                },
                variant: null,
            });

            for (const tier of body.wholesalePriceTiers) {

                const wholesaleTier = manager.create(
                    WholesalePriceTier,
                    {
                        product,
                        min_quantity: tier.min_quantity,
                        price: tier.price,
                        created_by: user.userId,
                    }
                );

                await manager.save(wholesaleTier);
            }
        }

        // ================= Variants =================

        if (body.variants) {

            // Delete old variants
            await manager.delete(Variant, {
                product: {
                    productId: product.productId,
                },
            });

            for (const item of body.variants) {

                const existingSku = await manager.findOne(
                    Variant,
                    {
                        where: {
                            sku: item.sku,
                        },
                    }
                );

                if (existingSku) {
                    throw new Error(
                        `SKU ${item.sku} already exists.`
                    );
                }

                let color = null;
                let size = null;

                if (item.colorId) {
                    color = await manager.findOne(Color, {
                        where: {
                            colorId: item.colorId,
                        },
                    });
                }

                if (item.sizeId) {
                    size = await manager.findOne(Size, {
                        where: {
                            sizeId: item.sizeId,
                        },
                    });
                }

                const discountedPrice =
                    Number(item.price) -
                    (Number(item.price) *
                        Number(
                            item.discount_percentage || 0
                        )) /
                    100;

                const variant = manager.create(Variant, {
                    product,
                    name: item.name,
                    sku: item.sku,
                    price: item.price,
                    discount_percentage:
                        item.discount_percentage || 0,
                    discounted_price:
                        discountedPrice,
                    stock: item.stock,
                    color,
                    size,
                    created_by: user.userId,
                });

                const savedVariant =
                    await manager.save(variant);

                // Variant Images

                if (item.images?.length) {
                    for (const image of item.images) {
                        const variantImage =
                            manager.create(
                                VariantImage,
                                {
                                    variant:
                                        savedVariant,
                                    image_url:
                                        image.image_url,
                                    created_by:
                                        user.userId,
                                }
                            );

                        await manager.save(
                            variantImage
                        );
                    }
                }

                // Variant Technical Details

                if (
                    item.technicalDetails?.length
                ) {
                    for (const detail of item.technicalDetails) {
                        const technicalDetail =
                            manager.create(
                                VariantTechnicalDetail,
                                {
                                    variant:
                                        savedVariant,
                                    key: detail.key,
                                    value: detail.value,
                                }
                            );

                        await manager.save(
                            technicalDetail
                        );
                    }
                }

                // ================= Variant Wholesale Price Tiers =================

                if (item.wholesalePriceTiers?.length) {

                    await manager.delete(WholesalePriceTier, {
                        variant: {
                            variantId: savedVariant.variantId,
                        },
                    });


                    for (const tier of item.wholesalePriceTiers) {

                        const wholesaleTier = manager.create(
                            WholesalePriceTier,
                            {
                                product,
                                variant: savedVariant,
                                min_quantity: tier.min_quantity,
                                price: tier.price,
                                created_by: user.userId,
                            }
                        );

                        await manager.save(wholesaleTier);
                    }
                }
            }
        }

        return await manager.findOne(Product, {
            where: {
                productId: product.productId,
            },
            relations: [
                "category",
                "category.client",
                "media",
                "technicalDetails",
                "wholesalePriceTiers",

                "variants",
                "variants.color",
                "variants.size",
                "variants.variantImages",
                "variants.technicalDetails",
                "variants.wholesalePriceTiers",
            ],
        });
    });
};

export const deleteProduct = async (
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

    if (
        user.role.name !== Role.SUPER_ADMIN &&
        user.role.name !== Role.CLIENT
    ) {
        throw new Error("You are not authorized.");
    }

    let product;

    if (user.role.name === Role.SUPER_ADMIN) {
        product = await productRepository.findOne({
            where: { productId },
        });
    } else {
        product = await productRepository.findOne({
            where: {
                productId,
                category: {
                    client: {
                        clientId: user.client.clientId,
                    },
                }
            },
            relations: ["category"],
        });
    }

    if (!product) {
        throw new Error("Product not found.");
    }

    product.is_active = false;
    product.updated_by = user.userId;

    await productRepository.save(product);

    return {
        status: true,
        message: "Product deleted successfully.",
    };
};