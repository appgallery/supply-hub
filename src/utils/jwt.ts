import jwt from "jsonwebtoken";

export const generateAccessToken = (user: any) => {
    return jwt.sign(
        {
            userId: user.userId,
            roleId: user.role.roleId,
            clientId: user.client?.clientId,
            subClientId: user.subClient?.subClientId,
        },
        process.env.JWT_SECRET!,
        {
            expiresIn: "15m",
        }
    );
};

export const verifyAccessToken = (token: string) => {
    return jwt.verify(token, process.env.JWT_SECRET as string);
};

export const verifyRefreshToken = (token: string) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string);
};