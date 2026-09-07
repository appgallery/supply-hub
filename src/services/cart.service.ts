import { AppDataSource } from "../database/data-source";
import { Cart } from "../entities/Cart";
import { CartItem } from "../entities/CartItem";
import { User } from "../entities/User";
import { Variant } from "../entities/Variants";
import { Role } from "../utils/constants";

export const userRepository = AppDataSource.getRepository(User);
export const variantRepository = AppDataSource.getRepository(Variant);
export const cartRepository = AppDataSource.getRepository(Cart);
export const cartItemRepository = AppDataSource.getRepository(CartItem);


export const addToCart = async (
    body: any,
    userId: number,
    roleName: string
) => {

    const { variantId, quantity } = body;

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
    }

    if (!variantId) {
        throw new Error("Variant is required.");
    }

    if (!quantity || quantity <= 0) {
        throw new Error("Quantity should be greater than zero.");
    }

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "subClient",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (!user.subClient) {
        throw new Error("Sub client not found.");
    }


    const variant = await variantRepository.findOne({
        where: {
            variantId,
            is_active: true,
        },
        relations: [
            "product",
            "color",
            "size",
        ],
    });

    if (!variant) {
        throw new Error("Variant not found.");
    }

    if (variant.stock < quantity) {
        throw new Error(
            `${variant.name} has only ${variant.stock} items available.`
        );
    }

    let cart = await cartRepository.findOne({
        where: {
            user_id: userId,
        },
        relations: [
            "cartItems",
        ],
    });

    if (!cart) {

        cart = cartRepository.create({
            user,
            user_id: userId,
        });

        cart = await cartRepository.save(cart);
    }

    let cartItem = await cartItemRepository.findOne({
        where: {
            cart_id: cart.cartId,
            variant_id: variantId,
        },
        relations: [
            "variant",
        ],
    });

    const price = Number(variant.price);

    const discountPercentage =
        Number(variant.discount_percentage || 0);

    // --------------------------------
    // 8. Existing cart item
    // --------------------------------

    if (cartItem) {

        const totalQty =
            cartItem.quantity + quantity;

        // Check total quantity against stock
        if (variant.stock < totalQty) {
            throw new Error(
                `${variant.name} has only ${variant.stock} items available.`
            );
        }

        // Calculate using TOTAL quantity
        const {
            subtotal,
            discount,
            total,
        } = calculateItemAmounts(
            price,
            totalQty,
            discountPercentage
        );

        cartItem.quantity = totalQty;

        cartItem.price = price;

        cartItem.discount_percentage =
            discountPercentage;

        cartItem.discount_amount =
            discount;

        cartItem.discounted_amount =
            total;

        cartItem.amount =
            total;

        await cartItemRepository.save(cartItem);

    }

    else {

        const {
            subtotal,
            discount,
            total,
        } = calculateItemAmounts(
            price,
            quantity,
            discountPercentage
        );

        cartItem = cartItemRepository.create({
            cart,

            cart_id: cart.cartId,

            variant,

            variant_id: variant.variantId,

            quantity,

            price,

            discount_percentage:
                discountPercentage,

            discount_amount:
                discount,

            discounted_amount:
                total,

            amount:
                total,
        });

        await cartItemRepository.save(cartItem);
    }

    // --------------------------------
    // 10. Return complete cart item
    // --------------------------------

    const savedCartItem =
        await cartItemRepository.findOne({
            where: {
                cartItemId:
                    cartItem.cartItemId,
            },
            relations: [
                "cart",
                "variant",
                "variant.product",
                "variant.color",
                "variant.size",
            ],
        });

    return savedCartItem;
};


export const getCart = async (
    userId: number,
    roleName: string
) => {

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
    }

    // Get sub client + client tax information
    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: [
            "subClient",
            "subClient.client",
        ],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const cart = await cartRepository.findOne({
        where: {
            user_id: userId,
        },
        relations: [
            "cartItems",
            "cartItems.variant",
            "cartItems.variant.product",
            "cartItems.variant.color",
            "cartItems.variant.size",
            "cartItems.variant.variantImages",
        ],
    });

    if (!cart || !cart.cartItems || cart.cartItems.length === 0) {
        return {
            items: []
        };
    }

    let subtotal = 0;
    let totalDiscount = 0;
    let maxDeliveryDays = 0;

    const items = cart.cartItems.map((item) => {

        const productMaxDeliveryDays =
            Number(item.variant.product?.max_delivery_days || 0);

        if (productMaxDeliveryDays > maxDeliveryDays) {
            maxDeliveryDays = productMaxDeliveryDays;
        }

        const price = Number(item.price);

        const discountPercentage =
            Number(item.discount_percentage);

        const discount =
            (price * discountPercentage) / 100;

        const finalPrice =
            price - discount;

        const total =
            finalPrice * item.quantity;

        subtotal +=
            price * item.quantity;

        totalDiscount +=
            discount * item.quantity;


        return {
            cartItemId: item.cartItemId,
            quantity: item.quantity,
            price,

            discountPercentage,

            finalPrice,

            total,

            variant: {
                variantId:
                    item.variant.variantId,

                name:
                    item.variant.name,

                sku:
                    item.variant.sku,

                availableStock:
                    item.variant.stock,

                price:
                    Number(item.variant.price),

                discounted_price:
                    Number(item.variant.discounted_price),

                color:
                    item.variant.color,

                size:
                    item.variant.size,

                images:
                    item.variant.variantImages?.map((image) => ({
                        variantImageId:
                            image.variantImageId,

                        imageUrl:
                            image.image_url,

                        alt_text:
                            image.alt_text,

                        is_thumbnail:
                            image.is_thumbnail,
                    })) || [],
            },
        };
    });

    const expectedDeliveryDate =
        getExpectedDeliveryDate(maxDeliveryDays);

    // Amount after discount
    const totalBeforeTax =
        subtotal - totalDiscount;

    // Get tax percentage from Client
    const taxPercentage =
        Number(user.subClient?.client?.taxRate) || 0;

    // Calculate tax
    const taxAmount =
        (totalBeforeTax * taxPercentage) / 100;

    const shippingAmount =
        Number(user.subClient?.shippingAmount) || 0;

    // Final total
    const grandTotal =
        totalBeforeTax +
        taxAmount +
        shippingAmount;

    return {
        cartId: cart.cartId,

        items,

        subtotal:
            Number(subtotal.toFixed(2)),

        totalDiscount:
            Number(totalDiscount.toFixed(2)),

        totalBeforeTax:
            Number(totalBeforeTax.toFixed(2)),

        taxPercentage:
            Number(taxPercentage.toFixed(2)),

        taxAmount:
            Number(taxAmount.toFixed(2)),

        shippingAmount:
            Number(shippingAmount.toFixed(2)),

        grandTotal:
            Number(grandTotal.toFixed(2)),

        expectedDeliveryDate
    };
};

export const updateCartItem = async (
    cartItemId: number,
    body: any,
    userId: number,
    roleName: string
) => {

    const { quantity } = body;

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
    }

    if (!quantity || quantity <= 0) {
        throw new Error("Quantity should be greater than zero.");
    }

    const cartItem = await cartItemRepository.findOne({
        where: {
            cartItemId,
            cart: {
                user_id: userId,
            },
        },
        relations: [
            "cart",
            "variant",
            "variant.product",
            "variant.color",
            "variant.size",
        ],
    });

    if (!cartItem) {
        throw new Error("Cart item not found.");
    }

    if (cartItem.variant.stock < quantity) {
        throw new Error(
            `${cartItem.variant.name} has only ${cartItem.variant.stock} items available.`
        );
    }

    cartItem.quantity = quantity;
    cartItem.price = Number(cartItem.variant.price);
    cartItem.discount_percentage = Number(
        cartItem.variant.discount_percentage
    );

    await cartItemRepository.save(cartItem);

    return cartItem;
};

export const deleteCartItem = async (
    cartItemId: number,
    userId: number,
    roleName: string
) => {

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
    }

    const cartItem = await cartItemRepository.findOne({
        where: {
            cartItemId,
            cart: {
                user_id: userId,
            },
        },
        relations: [
            "cart",
        ],
    });

    if (!cartItem) {
        throw new Error("Cart item not found.");
    }

    const cartId = cartItem.cart.cartId;

    await cartItemRepository.remove(cartItem);

    const remainingItems = await cartItemRepository.count({
        where: {
            cart_id: cartId,
        },
    });

    if (remainingItems === 0) {
        await cartRepository.delete({
            cartId,
        });
    }

    return {
        message: "Cart item deleted successfully.",
    };
};

const getExpectedDeliveryDate = (maxDeliveryDays?: number | null) => {
    if (!maxDeliveryDays) return null;

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + Number(maxDeliveryDays));

    return expectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
};

const calculateItemAmounts = (
    price: number,
    quantity: number,
    discountPercentage: number
) => {
    const subtotal = price * quantity;

    const discount =
        (subtotal * discountPercentage) / 100;

    const total =
        subtotal - discount;

    return {
        subtotal,
        discount,
        total,
    };
};