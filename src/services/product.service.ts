import { EntityManager, IsNull, MoreThanOrEqual } from "typeorm";
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
import { OrderItem } from "../entities/OrderItem";

const productRepository = AppDataSource.getRepository(Product);
const userRepository = AppDataSource.getRepository(User);
const clientRepository = AppDataSource.getRepository(Client);
const categoryRepository = AppDataSource.getRepository(Category);
const productTechnicalDetailRepository = AppDataSource.getRepository(ProductTechnicalDetail);
const variantTechnicalDetailsRepository = AppDataSource.getRepository(VariantTechnicalDetail);
const variantRepository = AppDataSource.getRepository(Variant);
const variantImageRepository = AppDataSource.getRepository(VariantImage);
const wholesalePriceTierRepository = AppDataSource.getRepository(WholesalePriceTier);
const productMediaRepository = AppDataSource.getRepository(ProductMedia);

export const createProduct = async (
    body: any,
    userId: number
) => {
    return await AppDataSource.transaction(async (manager) => {
        const {
            productName,
            description,
            base_price,
            unit_text,
            min_delivery_days,
            max_delivery_days,
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

        console.log("CREATE PRODUCT START");
        const product = manager.create(Product, {
            productCode,
            productName,
            description,
            unit_text,
            min_delivery_days,
            max_delivery_days,
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

        if (wholesalePriceTiers?.length) {

            for (const tier of wholesalePriceTiers) {

                const wholesaleTier = manager.create(
                    WholesalePriceTier,
                    {
                        product: savedProduct,
                        variant: null,
                        min_quantity: tier.min_quantity,
                        price: tier.price,
                        created_by: user.userId,
                    }
                );

                await manager.save(wholesaleTier);

                console.log("Saving product tier:", tier);
            }
        }

        // ================= Variants =================

        for (const item of variants) {
            const sku = await generateVariantSku(manager);

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
                sku,
                price: item.price,
                unit_text: item.unit_text,
                min_delivery_days: item.min_delivery_days,
                max_delivery_days: item.max_delivery_days,
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
                        alt_text: image.alt_text,
                        is_thumbnail: image.is_thumbnail ?? false,
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

export const generateVariantSku = async (
    manager: EntityManager
): Promise<string> => {
    while (true) {
        const sku = `SKU${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const exists = await manager.findOne(Variant, {
            where: { sku },
        });

        if (!exists) {
            return sku;
        }
    }
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
    console.log("========== GET PRODUCTS START ==========");

    const safeOffset = Math.max(
        0,
        Number(offset) || 0
    );

    const safeLimit = Math.min(
        Math.max(1, Number(limit) || 10),
        100
    );

    // =========================================================
    // 1. GET USER
    // =========================================================

    console.time("USER_QUERY");

    const user = await userRepository.findOne({
        where: { userId },
        relations: ["client", "role"],
    });

    console.timeEnd("USER_QUERY");

    if (!user) {
        throw new Error("User not found.");
    }

    // =========================================================
    // 2. BASE PRODUCT QUERY
    //
    // IMPORTANT:
    // Do NOT join variants/media/technical details here.
    // Only category/client are joined because they are used
    // for filtering.
    // =========================================================

    const productQuery = productRepository
        .createQueryBuilder("product")
        .leftJoin(
            "product.category",
            "category"
        )
        .leftJoin(
            "category.client",
            "client"
        )
        .where(
            "product.is_active = :active",
            {
                active: true,
            }
        );

    // =========================================================
    // CLIENT FILTER
    // =========================================================

    if (user.role.name !== Role.SUPER_ADMIN) {
        productQuery.andWhere(
            "client.clientId = :clientId",
            {
                clientId:
                    user.client.clientId,
            }
        );
    }

    // =========================================================
    // CATEGORY FILTER
    // =========================================================

    if (categoryId) {
        productQuery.andWhere(
            "category.categoryId = :categoryId",
            {
                categoryId,
            }
        );
    }

    // =========================================================
    // SEARCH
    // =========================================================

    if (search?.trim()) {
        const searchValue =
            `%${search.trim()}%`;

        productQuery.andWhere(
            `
            (
                category.categoryName ILIKE :search

                OR product.productName ILIKE :search

                OR product.productCode ILIKE :search

                OR EXISTS (
                    SELECT 1
                    FROM variants variantSearch
                    WHERE variantSearch.productId = product.productId
                    AND (
                        variantSearch.sku ILIKE :search
                        OR variantSearch.name ILIKE :search
                    )
                )

                OR EXISTS (
                    SELECT 1
                    FROM variants variantColorSearch
                    INNER JOIN color colorSearch
                        ON colorSearch.colorId =
                           variantColorSearch.colorId
                    WHERE variantColorSearch.productId =
                          product.productId
                    AND colorSearch.name ILIKE :search
                )

                OR EXISTS (
                    SELECT 1
                    FROM variants variantSizeSearch
                    INNER JOIN size sizeSearch
                        ON sizeSearch.sizeId =
                           variantSizeSearch.sizeId
                    WHERE variantSizeSearch.productId =
                          product.productId
                    AND sizeSearch.name ILIKE :search
                )
            )
            `,
            {
                search: searchValue,
            }
        );
    }

    // =========================================================
    // SORT
    // =========================================================

    const direction: "ASC" | "DESC" =
        sortOrder === "ASC"
            ? "ASC"
            : "DESC";

    switch (sortBy) {
        case "name":
            productQuery.orderBy(
                "product.productName",
                direction
            );
            break;

        case "createdAt":
            productQuery.orderBy(
                "product.created_at",
                direction
            );
            break;

        case "price_low":
            productQuery.orderBy(
                "product.base_price",
                "ASC"
            );
            break;

        case "price_high":
            productQuery.orderBy(
                "product.base_price",
                "DESC"
            );
            break;

        case "most_sold":
            /*
             * Keep your existing behavior for now.
             *
             * We need your order/order-item entity to implement
             * the real most_sold calculation.
             */
            productQuery.orderBy(
                "product.productId",
                direction
            );
            break;

        case "productId":
        default:
            productQuery.orderBy(
                "product.productId",
                direction
            );
            break;
    }

    // =========================================================
    // 3. TOTAL COUNT
    // =========================================================

    console.time("COUNT_QUERY");

    const total =
        await productQuery.getCount();

    console.timeEnd("COUNT_QUERY");

    // =========================================================
    // 4. GET PRODUCT IDS FOR CURRENT PAGE
    //
    // This query only returns IDs.
    // No huge relations.
    // =========================================================

    console.time("PRODUCT_ID_QUERY");

    const idRows =
        await productQuery
            .select(
                "product.productId",
                "productId"
            )
            .skip(safeOffset)
            .take(safeLimit)
            .getRawMany();

    console.timeEnd("PRODUCT_ID_QUERY");

    const productIds =
        idRows.map(row =>
            Number(row.productId)
        );

    console.log(
        "Product IDs:",
        productIds
    );

    if (productIds.length === 0) {
        console.log(
            "No products found."
        );

        return {
            products: [],
            total,
            offset: safeOffset,
            limit: safeLimit,
        };
    }

    // =========================================================
    // 5. GET PRODUCTS + CATEGORY
    // =========================================================

    console.time("PRODUCT_BASE_QUERY");

    const products =
        await productRepository
            .createQueryBuilder("product")
            .leftJoinAndSelect(
                "product.category",
                "category"
            )
            .where(
                "product.productId IN (:...productIds)",
                {
                    productIds,
                }
            )
            .getMany();

    console.timeEnd("PRODUCT_BASE_QUERY");

    // =========================================================
    // 6. GET VARIANTS
    //
    // Uses variant.product instead of variant.productId.
    // =========================================================

    console.time("VARIANTS_QUERY");

    const variants =
        await variantRepository
            .createQueryBuilder("variant")
            .leftJoinAndSelect(
                "variant.product",
                "product"
            )
            .leftJoinAndSelect(
                "variant.color",
                "color"
            )
            .leftJoinAndSelect(
                "variant.size",
                "size"
            )
            .where(
                "product.productId IN (:...productIds)",
                {
                    productIds,
                }
            )
            .getMany();

    console.timeEnd("VARIANTS_QUERY");

    const variantIds =
        variants.map(
            variant =>
                variant.variantId
        );

    console.log(
        "Variant count:",
        variants.length
    );

    // =========================================================
    // 7. LOAD ALL CHILD RELATIONS IN PARALLEL
    // =========================================================

    console.time(
        "ALL_RELATIONS_QUERY"
    );

    const [
        variantImages,
        variantTechnicalDetails,
        wholesalePriceTiers,
        productMedia,
        productTechnicalDetails,
    ] = await Promise.all([
        // -----------------------------------------------------
        // VARIANT IMAGES
        // -----------------------------------------------------

        variantIds.length > 0
            ? variantImageRepository
                .createQueryBuilder("image")
                .leftJoinAndSelect(
                    "image.variant",
                    "variant"
                )
                .where(
                    "variant.variantId IN (:...variantIds)",
                    {
                        variantIds,
                    }
                )
                .getMany()
            : [],

        // -----------------------------------------------------
        // VARIANT TECHNICAL DETAILS
        // -----------------------------------------------------

        variantIds.length > 0
            ? variantTechnicalDetailsRepository
                .createQueryBuilder(
                    "technicalDetails"
                )
                .leftJoinAndSelect(
                    "technicalDetails.variant",
                    "variant"
                )
                .where(
                    "variant.variantId IN (:...variantIds)",
                    {
                        variantIds,
                    }
                )
                .getMany()
            : [],

        // -----------------------------------------------------
        // WHOLESALE PRICE TIERS
        //
        // Your entity has:
        //
        // product: Product
        // variant: Variant | null
        //
        // So fetch both types in ONE query.
        // -----------------------------------------------------

        wholesalePriceTierRepository
            .createQueryBuilder("tier")
            .leftJoinAndSelect(
                "tier.product",
                "tierProduct"
            )
            .leftJoinAndSelect(
                "tier.variant",
                "tierVariant"
            )
            .where(
                `
                tierProduct.productId IN (:...productIds)

                OR

                tierVariant.variantId IN (:...variantIds)
                `,
                {
                    productIds,
                    variantIds:
                        variantIds.length > 0
                            ? variantIds
                            : [0],
                }
            )
            .getMany(),

        // -----------------------------------------------------
        // PRODUCT MEDIA
        // -----------------------------------------------------

        productMediaRepository
            .createQueryBuilder("media")
            .leftJoinAndSelect(
                "media.product",
                "product"
            )
            .where(
                "product.productId IN (:...productIds)",
                {
                    productIds,
                }
            )
            .getMany(),

        // -----------------------------------------------------
        // PRODUCT TECHNICAL DETAILS
        // -----------------------------------------------------

        productTechnicalDetailRepository
            .createQueryBuilder(
                "technicalDetails"
            )
            .leftJoinAndSelect(
                "technicalDetails.product",
                "product"
            )
            .where(
                "product.productId IN (:...productIds)",
                {
                    productIds,
                }
            )
            .getMany(),
    ]);

    console.timeEnd(
        "ALL_RELATIONS_QUERY"
    );

    // =========================================================
    // 8. CREATE MAPS
    // =========================================================

    // ---------------------------------------------------------
    // Variants by product
    // ---------------------------------------------------------

    const variantsByProduct =
        new Map<number, Variant[]>();

    for (const variant of variants) {
        const productId =
            variant.product?.productId;

        if (!productId) {
            continue;
        }

        if (
            !variantsByProduct.has(
                productId
            )
        ) {
            variantsByProduct.set(
                productId,
                []
            );
        }

        variantsByProduct
            .get(productId)!
            .push(variant);
    }

    // ---------------------------------------------------------
    // Images by variant
    // ---------------------------------------------------------

    const imagesByVariant =
        new Map<number, any[]>();

    for (const image of variantImages) {
        const variantId =
            image.variant?.variantId ??
            image.variantId;

        if (!variantId) {
            continue;
        }

        if (
            !imagesByVariant.has(
                variantId
            )
        ) {
            imagesByVariant.set(
                variantId,
                []
            );
        }

        imagesByVariant
            .get(variantId)!
            .push(image);
    }

    // ---------------------------------------------------------
    // Variant technical details
    // ---------------------------------------------------------

    const variantTechnicalDetailsByVariant =
        new Map<number, any[]>();

    for (const detail of variantTechnicalDetails) {
        const variantId =
            detail.variant?.variantId ??
            detail.variantId;

        if (!variantId) {
            continue;
        }

        if (
            !variantTechnicalDetailsByVariant.has(
                variantId
            )
        ) {
            variantTechnicalDetailsByVariant.set(
                variantId,
                []
            );
        }

        variantTechnicalDetailsByVariant
            .get(variantId)!
            .push(detail);
    }

    // ---------------------------------------------------------
    // Product wholesale tiers
    // ---------------------------------------------------------

    const productWholesalePriceTiers =
        new Map<number, WholesalePriceTier[]>();

    // ---------------------------------------------------------
    // Variant wholesale tiers
    // ---------------------------------------------------------

    const variantWholesalePriceTiers =
        new Map<number, WholesalePriceTier[]>();

    for (const tier of wholesalePriceTiers) {
        // Product tier
        if (tier.product) {
            const productId =
                tier.product.productId;

            if (
                !productWholesalePriceTiers.has(
                    productId
                )
            ) {
                productWholesalePriceTiers.set(
                    productId,
                    []
                );
            }

            productWholesalePriceTiers
                .get(productId)!
                .push(tier);
        }

        // Variant tier
        if (tier.variant) {
            const variantId =
                tier.variant.variantId;

            if (
                !variantWholesalePriceTiers.has(
                    variantId
                )
            ) {
                variantWholesalePriceTiers.set(
                    variantId,
                    []
                );
            }

            variantWholesalePriceTiers
                .get(variantId)!
                .push(tier);
        }
    }

    // ---------------------------------------------------------
    // Media by product
    // ---------------------------------------------------------

    const mediaByProduct =
        new Map<number, any[]>();

    for (const media of productMedia) {
        const productId =
            media.product?.productId ??
            media.product?.productId;

        if (!productId) {
            continue;
        }

        if (
            !mediaByProduct.has(
                productId
            )
        ) {
            mediaByProduct.set(
                productId,
                []
            );
        }

        mediaByProduct
            .get(productId)!
            .push(media);
    }

    // ---------------------------------------------------------
    // Product technical details
    // ---------------------------------------------------------

    const productTechnicalDetailsByProduct =
        new Map<number, any[]>();

    for (
        const detail of productTechnicalDetails
    ) {
        const productId =
            detail.product?.productId ??
            detail.product?.productId;

        if (!productId) {
            continue;
        }

        if (
            !productTechnicalDetailsByProduct.has(
                productId
            )
        ) {
            productTechnicalDetailsByProduct.set(
                productId,
                []
            );
        }

        productTechnicalDetailsByProduct
            .get(productId)!
            .push(detail);
    }

    // =========================================================
    // 9. ATTACH VARIANT RELATIONS
    // =========================================================

    for (const variant of variants) {
        variant.variantImages =
            imagesByVariant.get(
                variant.variantId
            ) ?? [];

        variant.technicalDetails =
            variantTechnicalDetailsByVariant.get(
                variant.variantId
            ) ?? [];

        variant.wholesalePriceTiers =
            variantWholesalePriceTiers.get(
                variant.variantId
            ) ?? [];
    }

    // =========================================================
    // 10. ATTACH PRODUCT RELATIONS
    // =========================================================

    for (const product of products) {
        product.variants =
            variantsByProduct.get(
                product.productId
            ) ?? [];

        product.media =
            mediaByProduct.get(
                product.productId
            ) ?? [];

        product.technicalDetails =
            productTechnicalDetailsByProduct.get(
                product.productId
            ) ?? [];

        product.wholesalePriceTiers =
            productWholesalePriceTiers.get(
                product.productId
            ) ?? [];
    }

    // =========================================================
    // 11. RESTORE PAGINATION ORDER
    // =========================================================

    const productMap =
        new Map(
            products.map(product => [
                product.productId,
                product,
            ])
        );

    const orderedProducts =
        productIds
            .map(id =>
                productMap.get(id)
            )
            .filter(
                (
                    product
                ): product is NonNullable<
                    typeof product
                > =>
                    Boolean(product)
            );

    // =========================================================
    // FINAL RESPONSE
    // =========================================================

    console.log(
        "Products:",
        orderedProducts.length
    );

    console.log(
        "Total:",
        total
    );

    console.log(
        "========== GET PRODUCTS END =========="
    );

    return {
        products: orderedProducts,
        total,
        offset: safeOffset,
        limit: safeLimit,
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

    // Get only product + category + client
    const product = await productRepository.findOne({
        where: {
            productId,
            is_active: true,
        },
        relations: [
            "category",
            "category.client",
        ],
    });

    if (!product) {
        throw new Error("Product not found.");
    }

    // Client restriction
    if (
        user.role.name !== Role.SUPER_ADMIN &&
        product.category.client.clientId !== user.client.clientId
    ) {
        throw new Error("Product not found.");
    }

    // Load remaining relations in parallel
    const [
        media,
        technicalDetails,
        wholesalePriceTiers,
        variants,
    ] = await Promise.all([

        productMediaRepository.find({
            where: {
                product: {
                    productId,
                },
            },
        }),

        productTechnicalDetailRepository.find({
            where: {
                product: {
                    productId,
                },
            },
        }),

        wholesalePriceTierRepository.find({
            where: {
                product: {
                    productId,
                },
                variant: IsNull(), // Product level tiers only
            },
        }),

        variantRepository.find({
            where: {
                product: {
                    productId,
                },
            },
            relations: [
                "color",
                "size",
                "variantImages",
                "technicalDetails",
                "wholesalePriceTiers",
            ],
            order: {
                variantId: "ASC",
            },
        }),
    ]);

    product.media = media;
    product.technicalDetails = technicalDetails;
    product.wholesalePriceTiers = wholesalePriceTiers;
    product.variants = variants;

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

    console.log("========== UPDATE PRODUCT API HIT ==========");
    console.log("Product ID:", productId);
    console.log("Time:", new Date().toISOString());

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


        product.unit_text =
            body.unit_text ?? product.unit_text;

        product.min_delivery_days =
            body.min_delivery_days ?? product.min_delivery_days;

        product.max_delivery_days =
            body.max_delivery_days ?? product.max_delivery_days;

        product.discounted_price =
            Number(product.base_price) -
            (Number(product.base_price) *
                Number(product.discount_percentage)) /
            100;

        product.updated_by = user.userId;

        await manager.save(product);

        // ================= Product Images =================

        if (body.media) {

            const existingMedia = await manager.find(ProductMedia, {
                where: {
                    product: {
                        productId: product.productId,
                    },
                },
            });


            const existingIds = existingMedia.map(
                media => media.mediaId
            );


            const requestIds = body.media
                .filter((media: any) => media.mediaId)
                .map((media: any) => media.mediaId);


            // Delete removed media
            const idsToDelete = existingIds.filter(
                id => !requestIds.includes(id)
            );


            if (idsToDelete.length) {
                await manager.delete(
                    ProductMedia,
                    idsToDelete
                );
            }


            // Update/Create
            for (const item of body.media) {
                if (item.mediaId) {
                    const existing = await manager.findOne(
                        ProductMedia,
                        {
                            where: {
                                mediaId: item.mediaId,
                            },
                        }
                    );

                    if (!existing) continue;

                    existing.media_url = item.media_url;
                    existing.media_type = item.media_type;
                    existing.updated_by = user.userId;

                    await manager.save(existing);

                } else {

                    const newMedia = manager.create(
                        ProductMedia,
                        {
                            product,
                            media_url: item.media_url,
                            media_type: item.media_type,
                            created_by: user.userId,
                        }
                    );


                    await manager.save(newMedia);
                }
            }
        }

        // ================= Product Technical Details =================

        if (body.technicalDetails) {

            const existingDetails = await manager.find(ProductTechnicalDetail, {
                where: {
                    product: {
                        productId: product.productId,
                    },
                },
            });

            const existingIds = existingDetails.map(
                d => d.technicalDetailId
            );

            const requestIds = body.technicalDetails
                .filter((d: any) => d.technicalDetailId)
                .map((d: any) => d.technicalDetailId);

            // Delete removed details
            const idsToDelete = existingIds.filter(
                id => !requestIds.includes(id)
            );

            if (idsToDelete.length) {
                await manager.delete(
                    ProductTechnicalDetail,
                    idsToDelete
                );
            }

            // Update/Create
            for (const detail of body.technicalDetails) {

                if (detail.technicalDetailId) {

                    const existing = await manager.findOne(ProductTechnicalDetail, {
                        where: {
                            technicalDetailId: detail.technicalDetailId,
                        },
                    });

                    if (!existing) continue;

                    existing.key = detail.key;
                    existing.value = detail.value;

                    await manager.save(existing);

                } else {

                    const newDetail = manager.create(ProductTechnicalDetail, {
                        product,
                        key: detail.key,
                        value: detail.value,
                    });

                    await manager.save(newDetail);
                }
            }
        }

        // ================= Product Wholesale Price Tiers =================

        if (body.wholesalePriceTiers) {

            const existingTiers = await manager.find(
                WholesalePriceTier,
                {
                    where: {
                        product: {
                            productId: product.productId,
                        },
                    },
                }
            );

            const existingIds = existingTiers.map(
                tier => tier.tierId
            );

            const requestIds = body.wholesalePriceTiers
                .filter((tier: any) => tier.tierId)
                .map((tier: any) => tier.tierId);


            // Delete removed tiers
            const idsToDelete = existingIds.filter(
                id => !requestIds.includes(id)
            );

            if (idsToDelete.length) {
                await manager.delete(
                    WholesalePriceTier,
                    idsToDelete
                );
            }


            // Update/Create
            for (const tier of body.wholesalePriceTiers) {

                if (tier.tierId) {

                    const existing = await manager.findOne(
                        WholesalePriceTier,
                        {
                            where: {
                                tierId:
                                    tier.tierId,
                            },
                        }
                    );

                    if (!existing) continue;

                    existing.min_quantity = tier.min_quantity;
                    existing.price = tier.price;

                    await manager.save(existing);

                } else {

                    const newTier = manager.create(
                        WholesalePriceTier,
                        {
                            product,
                            min_quantity: tier.min_quantity,
                            price: tier.price,
                            created_by: user.userId,
                        }
                    );

                    await manager.save(newTier);
                }
            }
        }
        // ================= Variants =================

        if (body.variants) {

            const existingVariants = await manager.find(Variant, {
                where: {
                    product: {
                        productId: product.productId,
                    },
                },
                relations: [
                    "variantImages",
                    "technicalDetails",
                    "wholesalePriceTiers",
                ],
            });

            const existingIds = existingVariants.map(v => v.variantId);

            const requestIds = body.variants
                .filter((v: any) => v.variantId)
                .map((v: any) => v.variantId);

            // Delete removed variants
            const idsToDelete = existingIds.filter(
                id => !requestIds.includes(id)
            );

            for (const variantId of idsToDelete) {

                const orderCount = await manager.count(OrderItem, {
                    where: {
                        variant: {
                            variantId,
                        },
                    },
                });

                if (orderCount > 0) {
                    throw new Error(
                        `Variant ${variantId} is used in orders and cannot be deleted.`
                    );
                }


                await manager.delete(Variant, {
                    variantId,
                });
            }

            for (const item of body.variants) {

                // SKU validation
                const existingSku = await manager.findOne(Variant, {
                    where: {
                        sku: item.sku,
                    },
                });

                if (
                    existingSku &&
                    existingSku.variantId !== item.variantId
                ) {
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
                        Number(item.discount_percentage || 0)) /
                    100;

                let variant: Variant;

                // UPDATE
                if (item.variantId) {

                    variant = await manager.findOneOrFail(Variant, {
                        where: {
                            variantId: item.variantId,
                        },
                    });

                    variant.name = item.name;
                    variant.sku = item.sku;
                    variant.price = item.price;
                    variant.stock = item.stock;
                    variant.unit_text = item.unit_text;
                    variant.min_delivery_days = item.min_delivery_days;
                    variant.max_delivery_days = item.max_delivery_days;
                    variant.discount_percentage =
                        item.discount_percentage || 0;
                    variant.discounted_price =
                        discountedPrice;
                    variant.color = color;
                    variant.size = size;

                    await manager.save(variant);

                } else {

                    // CREATE

                    variant = manager.create(Variant, {
                        product,
                        name: item.name,
                        sku: item.sku,
                        price: item.price,
                        stock: item.stock,
                        unit_text: item.unit_text,
                        min_delivery_days:
                            item.min_delivery_days,
                        max_delivery_days:
                            item.max_delivery_days,
                        discount_percentage:
                            item.discount_percentage || 0,
                        discounted_price:
                            discountedPrice,
                        color,
                        size,
                        created_by: user.userId,
                    });

                    variant = await manager.save(variant);
                }

                // ================= Variant Images =================

                if (item.images) {

                    const existingImages = await manager.find(VariantImage, {
                        where: {
                            variant: {
                                variantId: variant.variantId,
                            },
                        },
                    });

                    const existingIds = existingImages.map(
                        img => img.variantImageId
                    );

                    const requestIds = item.images
                        .filter((img: any) => img.variantImageId)
                        .map((img: any) => img.variantImageId);

                    // Delete removed images
                    const idsToDelete = existingIds.filter(
                        id => !requestIds.includes(id)
                    );

                    if (idsToDelete.length) {
                        await manager.delete(
                            VariantImage,
                            idsToDelete
                        );
                    }

                    // Update/Create
                    for (const image of item.images) {

                        if (image.variantImageId) {

                            const existing = await manager.findOne(
                                VariantImage,
                                {
                                    where: {
                                        variantImageId: image.variantImageId,
                                    },
                                }
                            );

                            if (!existing) continue;

                            existing.image_url = image.image_url;
                            existing.alt_text = image.alt_text;
                            existing.is_thumbnail = image.is_thumbnail;

                            await manager.save(existing);

                        } else {

                            await manager.save(
                                manager.create(VariantImage, {
                                    variant,
                                    image_url: image.image_url,
                                    alt_text: image.alt_text,
                                    is_thumbnail: image.is_thumbnail,
                                    created_by: user.userId,
                                })
                            );
                        }
                    }
                }

                // ================= Variant Wholesale Price Tiers =================

                if (item.wholesalePriceTiers) {

                    const existingTiers = await manager.find(
                        WholesalePriceTier,
                        {
                            where: {
                                variant: {
                                    variantId: variant.variantId,
                                },
                            },
                        }
                    );


                    const existingIds = existingTiers.map(
                        tier => tier.tierId
                    );


                    const requestIds = item.wholesalePriceTiers
                        .filter((tier: any) => tier.tierId)
                        .map((tier: any) => tier.tierId);


                    // Delete removed tiers
                    const idsToDelete = existingIds.filter(
                        id => !requestIds.includes(id)
                    );


                    if (idsToDelete.length) {
                        await manager.delete(
                            WholesalePriceTier,
                            idsToDelete
                        );
                    }


                    // Update / Create
                    for (const tier of item.wholesalePriceTiers) {

                        if (tier.tierId) {

                            const existing = await manager.findOne(
                                WholesalePriceTier,
                                {
                                    where: {
                                        tierId:
                                            tier.tierId,
                                    },
                                }
                            );


                            if (!existing) continue;


                            existing.min_quantity = tier.min_quantity;
                            existing.price = tier.price;


                            await manager.save(existing);

                        } else {

                            const newTier = manager.create(
                                WholesalePriceTier,
                                {
                                    variant,
                                    min_quantity: tier.min_quantity,
                                    price: tier.price,
                                    created_by: user.userId,
                                }
                            );


                            await manager.save(newTier);
                        }
                    }
                }

                // ================= Variant Technical Details =================

                if (item.technicalDetails) {



                    const existingDetails = await manager.find(VariantTechnicalDetail, {
                        where: {
                            variant: {
                                variantId: variant.variantId,
                            },
                        },
                    });

                    console.log(
                        "Variant ID:",
                        variant.variantId
                    );

                    console.log(
                        "Existing Details:",
                        existingDetails
                    );

                    console.log(
                        "Request Details:",
                        item.technicalDetails
                    );

                    const existingIds = existingDetails.map(
                        d => d.technicalDetailId
                    );

                    const requestIds = item.technicalDetails
                        .filter((d: any) => d.technicalDetailId)
                        .map((d: any) => d.technicalDetailId);

                    // Delete removed details
                    const idsToDelete = existingIds.filter(
                        id => !requestIds.includes(id)
                    );

                    if (idsToDelete.length) {
                        await manager.delete(
                            VariantTechnicalDetail,
                            idsToDelete
                        );
                    }

                    // Update/Create
                    for (const detail of item.technicalDetails) {

                        if (detail.technicalDetailId) {

                            const existing = await manager.findOne(
                                VariantTechnicalDetail,
                                {
                                    where: {
                                        technicalDetailId: detail.technicalDetailId,
                                    },
                                }
                            );

                            if (!existing) continue;

                            existing.key = detail.key;
                            existing.value = detail.value;

                            await manager.save(existing);

                        } else {

                            await manager.save(
                                manager.create(
                                    VariantTechnicalDetail,
                                    {
                                        variant,
                                        key: detail.key,
                                        value: detail.value,
                                    }
                                )
                            );
                        }
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