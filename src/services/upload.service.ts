import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";
import mime from "mime-types";
import { s3Client } from "../config/s3";

const ALLOWED_FOLDERS = ["products", "categories"];

const ALLOWED_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "jfif",
    "webp",
    "gif",
    "svg",
    "mp4",
    "mov",
    "avi",
    "webm",
    "mpeg",
];

export const uploadFiles = async (
    files: Express.Multer.File[],
    folder: string
) => {
    if (!ALLOWED_FOLDERS.includes(folder)) {
        throw new Error("Invalid folder.");
    }

    const uploadedFiles = await Promise.all(
        files.map(async (file) => {
            const extension = file.originalname
                .split(".")
                .pop()
                ?.toLowerCase();

            if (
                !extension ||
                !ALLOWED_EXTENSIONS.includes(extension)
            ) {
                throw new Error(
                    `Invalid file type: ${file.originalname}`
                );
            }

            const contentType =
                mime.lookup(file.originalname) ||
                "application/octet-stream";

            const key = `${folder}/${uuid()}.${extension}`;

            const command = new PutObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: contentType as string,
            });

            await s3Client.send(command);

            return {
                key,
                fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
            };
        })
    );

    return uploadedFiles;
};