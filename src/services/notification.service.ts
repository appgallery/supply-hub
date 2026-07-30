// src/services/notification.service.ts

import admin from "../config/firebase";

export const sendPushNotification = async (
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>
) => {
    if (!token) return;

    await admin.messaging().send({
        token,
        notification: {
            title,
            body,
        },
        data,
    });
};