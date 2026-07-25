import { BrevoClient } from "@getbrevo/brevo";

const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY!,
});

export const sendForgotPasswordOTP = async (
    email: string,
    name: string,
    otp: string
) => {
    try {
        const result = await brevo.transactionalEmails.sendTransacEmail({
            subject: "Reset Your Password",
            htmlContent: `
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Password Reset</h2>

                        <p>Hello ${name},</p>

                        <p>Your OTP is:</p>

                        <h1 style="letter-spacing:5px;color:#2563eb;">
                            ${otp}
                        </h1>

                        <p>This OTP will expire in <b>10 minutes</b>.</p>

                        <p>If you didn't request this, please ignore this email.</p>

                        <br>

                        <p>Thanks,</p>
                        <p>App Gallery Team</p>
                    </body>
                </html>
            `,
            sender: {
                name: process.env.BREVO_SENDER_NAME!,
                email: process.env.BREVO_SENDER_EMAIL!,
            },
            to: [
                {
                    email,
                    name,
                },
            ],
        });

        console.log("Email sent:", result.messageId);
    } catch (error) {
        console.error("Brevo Error:", error);
        throw new Error("Failed to send OTP email.");
    }
};