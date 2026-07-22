import { AppDataSource } from "../database/data-source";
import { ActivityLog } from "../entities/ActivityLog";
import { ActivityType } from "./constants";
export const activityLogRepository = AppDataSource.getRepository(ActivityLog);


export const generateOTP = (length: number = 6): string => {
    let otp = "";

    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10);
    }

    return otp;
};

export const generateRandomCode = (
    prefix: string,
    length: number = 6
): string => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let result = prefix;

    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return result;
};

export const createActivity = async (
    title: string,
    type: ActivityType,
    clientId?: number,
    subClientId?: number,
    userId?: number,
    description?: string
) => {

    const activity = activityLogRepository.create({
        title,
        type,
        clientId,
        subClientId,
        userId,
        description,
    });

    await activityLogRepository.save(activity);
};