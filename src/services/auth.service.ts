import { AppDataSource } from "../database/data-source";
import { RefreshToken } from "../entities/RefreshToken";
import { User } from "../entities/User";
import { generateAccessToken } from "../utils/jwt";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userRepository = AppDataSource.getRepository(User);
const refreshTokenRepository =
    AppDataSource.getRepository(RefreshToken);

export const login = async (body: any) => {
    const { email, password } = body;

    if (!email || !password) {
        throw new Error("Email and password are required.");
    }

    const user = await userRepository.findOne({
        where: {
            email,
        },
        relations: {
            role: true,
            client: true,
            subClient: true,
        },
    });

    if (!user) {
        throw new Error("Invalid email or password.");
    }

    const isPasswordCorrect = await bcrypt.compare(
        password,
        user.password
    );

    if (!isPasswordCorrect) {
        throw new Error("Invalid email or password.");
    }

    const accessToken = generateAccessToken(user);

    return {
        accessToken,
        user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role.name,
            clientId: user.client?.clientId,
            subClientId: user.subClient?.subClientId,
        },
    };
};

export const logout = async () => {
    return {
        message: "Logout successful.",
    };
};


export const forgotPassword = async (body: any) => {
    const { email } = body;

    if (!email) {
        throw new Error("Email is required.");
    }

    const user = await userRepository.findOne({
        where: { email },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const otp = Math.floor(
        100000 + Math.random() * 900000
    ).toString();

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await userRepository.save(user);

    return {
        message: "OTP sent successfully.",
        data: `OPT is ${otp}`
    };
};

export const resetPassword = async (body: any) => {
    const { email, otp, password } = body;

    const user = await userRepository.findOne({
        where: { email },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (user.otp !== otp) {
        throw new Error("Invalid OTP.");
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
        throw new Error("OTP has expired.");
    }

    user.password = await bcrypt.hash(password, 10);

    user.otp = null as any;
    user.otpExpiry = null as any;

    // Password is now user-defined
    user.isTemporaryPassword = false;

    await userRepository.save(user);

    return {
        message: "Password reset successfully.",
    };
};