import { AppDataSource } from "../database/data-source";
import { Cart } from "../entities/Cart";
import { TransactionStatus, TransactionType, Transaction, PaymentGateway } from "../entities/Transaction";
import { User } from "../entities/User";
import { razorpay } from "./razorpay.service";
export const userRepository = AppDataSource.getRepository(User);
export const transactionRepository = AppDataSource.getRepository(Transaction);
export const cartRepository = AppDataSource.getRepository(Cart);



// export const checkout = async (
//     body: any,
//     userId: number
// ) => {

//     const {
//         shippingAddressId
//     } = body;

//     const user = await userRepository.findOne({
//         where: {
//             userId,
//         },
//         relations: [
//             "role",
//             "subClient",
//         ],
//     });

//     if (!user) {
//         throw new Error("User not found.");
//     }

//     if (
//         user.role.name.toLowerCase() !== "dealer"
//     ) {
//         throw new Error("Only dealer can checkout.");
//     }

//     const cart = await cartRepository.find({
//         where: {
//             user_id: userId,
//         },
//         relations: [
//             "variant",
//             "variant.product",
//         ],
//     });

//     if (!cart.length) {
//         throw new Error("Cart is empty.");
//     }

//     for (const item of cart) {

//         if (
//             item.quantity > item.variant.stock
//         ) {
//             throw new Error(
//                 `${item.variant.name} is out of stock.`
//             );
//         }

//     }

//     let subtotal = 0;
//     let totalDiscount = 0;

//     for (const item of cart) {

//         const price = Number(item.variant.price);

//         const discount =
//             Number(item.variant.discount_percentage);

//         const discountedPrice =
//             price - (price * discount / 100);

//         subtotal += discountedPrice * item.quantity;

//         totalDiscount +=
//             (price - discountedPrice) *
//             item.quantity;

//     }

//     const shippingCharge = 0;

//     const grandTotal =
//         subtotal + shippingCharge;

//     const razorpayOrder =
//         await razorpay.orders.create({

//             amount: grandTotal * 100,

//             currency: "INR",

//             receipt:
//                 `ORDER_${Date.now()}`,

//         });

//     const transaction =
//         transactionRepository.create({

//             transaction_type: TransactionType.SALE,

//             transaction_status:
//                 TransactionStatus.PENDING,

//             payment_gateway:
//                 PaymentGateway.RAZORPAY,

//             amount: grandTotal,

//             currency: "INR",

//             gateway_order_id:
//                 razorpayOrder.id,

//             receipt:
//                 razorpayOrder.receipt,

//             gateway_response:
//                 razorpayOrder,

//         });

//     await transactionRepository.save(
//         transaction
//     );

//     return {

//         key:
//             process.env.RAZORPAY_KEY_ID,

//         razorpayOrderId:
//             razorpayOrder.id,

//         amount:
//             razorpayOrder.amount,

//         currency:
//             razorpayOrder.currency,

//         transactionId:
//             transaction.transactionId,

//     };
// }



