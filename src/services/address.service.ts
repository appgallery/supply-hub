import { AppDataSource } from "../database/data-source";
import { Address } from "../entities/Address";
import { SubClient } from "../entities/SubClient";
import { User } from "../entities/User";
import { AddressType, Role } from "../utils/constants";

export const addressRepository = AppDataSource.getRepository(Address);
export const subClientRepository = AppDataSource.getRepository(SubClient);
export const userRepository = AppDataSource.getRepository(User);


export const createAddress = async (
    body: any,
    userId: number,
    roleName: string
) => {

    const {
        addressType,
        contactPerson,
        mobileNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        isDefault,
    } = body;

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can manage addresses.");
    }

    if (!addressType) {
        throw new Error("Address type is required.");
    }

    if (
        addressType !== AddressType.SHIPPING &&
        addressType !== AddressType.BILLING
    ) {
        throw new Error("Invalid address type.");
    }

    if (!contactPerson) {
        throw new Error("Contact person is required.");
    }

    if (!mobileNumber) {
        throw new Error("Mobile number is required.");
    }

    if (!addressLine1) {
        throw new Error("Address line 1 is required.");
    }

    if (!city) {
        throw new Error("City is required.");
    }

    if (!state) {
        throw new Error("State is required.");
    }

    if (!country) {
        throw new Error("Country is required.");
    }

    if (!postalCode) {
        throw new Error("Postal code is required.");
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

    const subClient = await subClientRepository.findOne({
        where: {
            subClientId: user.subClient.subClientId,
        },
    });

    if (!subClient) {
        throw new Error("Sub client not found.");
    }

    // Allow only one billing address
    if (addressType === AddressType.BILLING) {

        const billingAddress = await addressRepository.findOne({
            where: {
                subClientId: subClient.subClientId,
                addressType: AddressType.BILLING,
            },
        });

        if (billingAddress) {
            throw new Error("Billing address already exists.");
        }
    }

    // Maintain only one default address per type
    if (isDefault) {

        await addressRepository.update(
            {
                subClientId: subClient.subClientId,
                addressType,
                isDefault: true,
            },
            {
                isDefault: false,
            }
        );
    }

    const address = addressRepository.create({
        subClient,
        subClientId: subClient.subClientId,
        addressType,
        contactPerson,
        mobileNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        isDefault: isDefault ?? false,
    });

    await addressRepository.save(address);

    const savedAddress = await addressRepository.findOne({
        where: {
            addressId: address.addressId,
        },
        relations: [
            "subClient",
        ],
    });

    return savedAddress;
};

export const getAddresses = async (
    userId: number,
    roleName: string,
    addressType?: AddressType
) => {

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
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

    const whereCondition: any = {
        subClientId: user.subClient.subClientId,
    };

    if (addressType) {
        whereCondition.addressType = addressType;
    }

    const addresses = await addressRepository.find({
        where: whereCondition,
        order: {
            isDefault: "DESC",
            created_at: "DESC",
        },
    });

    return addresses;
};

export const getAddressById = async (
    addressId: number,
    userId: number,
    roleName: string
) => {

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
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

    const address = await addressRepository.findOne({
        where: {
            addressId,
            subClientId: user.subClient.subClientId,
        },
    });

    if (!address) {
        throw new Error("Address not found.");
    }

    return address;
};

export const updateAddress = async (
    addressId: number,
    body: any,
    userId: number,
    roleName: string
) => {

    const {
        addressType,
        contactPerson,
        mobileNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        isDefault,
    } = body;

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
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

    const address = await addressRepository.findOne({
        where: {
            addressId,
            subClientId: user.subClient.subClientId,
        },
    });

    if (!address) {
        throw new Error("Address not found.");
    }

    const newAddressType = addressType ?? address.addressType;

    // Allow only one billing address
    if (newAddressType === AddressType.BILLING) {

        const billingAddress = await addressRepository.findOne({
            where: {
                subClientId: user.subClient.subClientId,
                addressType: AddressType.BILLING,
            },
        });

        if (
            billingAddress &&
            billingAddress.addressId !== address.addressId
        ) {
            throw new Error("Billing address already exists.");
        }
    }

    if (isDefault) {

        await addressRepository.update(
            {
                subClientId: user.subClient.subClientId,
                addressType: newAddressType,
                isDefault: true,
            },
            {
                isDefault: false,
            }
        );
    }

    address.addressType = newAddressType;
    address.contactPerson = contactPerson ?? address.contactPerson;
    address.mobileNumber = mobileNumber ?? address.mobileNumber;
    address.addressLine1 = addressLine1 ?? address.addressLine1;
    address.addressLine2 = addressLine2 ?? address.addressLine2;
    address.city = city ?? address.city;
    address.state = state ?? address.state;
    address.country = country ?? address.country;
    address.postalCode = postalCode ?? address.postalCode;

    if (isDefault !== undefined) {
        address.isDefault = isDefault;
    }

    await addressRepository.save(address);

    return address;
};

export const deleteAddress = async (
    addressId: number,
    userId: number,
    roleName: string
) => {

    if (roleName !== Role.SUB_CLIENT) {
        throw new Error("Only sub client can access this API.");
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

    const address = await addressRepository.findOne({
        where: {
            addressId,
            subClientId: user.subClient.subClientId,
        },
    });

    if (!address) {
        throw new Error("Address not found.");
    }

    await addressRepository.remove(address);

    return {
        message: "Address deleted successfully.",
    };
};