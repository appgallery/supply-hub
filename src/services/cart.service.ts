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

    if (cartItem) {

        const totalQty = cartItem.quantity + quantity;

        if (variant.stock < totalQty) {
            throw new Error(
                `${variant.name} has only ${variant.stock} items available.`
            );
        }

        cartItem.quantity = totalQty;
        cartItem.price = Number(variant.price);
        cartItem.discount_percentage = Number(
            variant.discount_percentage
        );

        await cartItemRepository.save(cartItem);

    } else {

        cartItem = cartItemRepository.create({
            cart,
            cart_id: cart.cartId,
            variant,
            variant_id: variant.variantId,
            quantity,
            price: Number(variant.price),
            discount_percentage: Number(
                variant.discount_percentage
            ),
        });

        await cartItemRepository.save(cartItem);
    }

    const savedCartItem = await cartItemRepository.findOne({
        where: {
            cartItemId: cartItem.cartItemId,
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
        ],
    });

    if (!cart) {

        return {
            cartId: null,
            items: [],
            subtotal: 0,
            totalDiscount: 0,
            grandTotal: 0,
        };
    }

    let subtotal = 0;
    let totalDiscount = 0;
    let grandTotal = 0;

    const items = cart.cartItems.map((item) => {

        const price = Number(item.price);

        const discount =
            (price * Number(item.discount_percentage)) / 100;

        const finalPrice = price - discount;

        const total = finalPrice * item.quantity;

        subtotal += price * item.quantity;
        totalDiscount += discount * item.quantity;
        grandTotal += total;

        return {
            cartItemId: item.cartItemId,
            quantity: item.quantity,
            price,
            discountPercentage: Number(
                item.discount_percentage
            ),
            finalPrice,
            total,
            variant: {
                variantId: item.variant.variantId,
                name: item.variant.name,
                sku: item.variant.sku,
                price: item.variant.price,

                color: item.variant.color,
                size: item.variant.size,

                images: item.variant.variantImages?.map((image) => ({
                    variantImageId: image.variantImageId,
                    imageUrl: image.image_url,
                    alt_text: image.alt_text,
                    is_thumbnail: image.is_thumbnail,
                })) || [],
            },
        };
    });

    return {
        cartId: cart.cartId,
        items,
        subtotal,
        totalDiscount,
        grandTotal,
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