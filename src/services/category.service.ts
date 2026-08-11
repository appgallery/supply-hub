import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Category } from "../entities/Category";
import { Client } from "../entities/Client";
import { User } from "../entities/User";
import { Role } from "../utils/constants";
import { generateCategoryXML, generateReadCategoryXML, sendCategoryXmlToTally } from "./categoryml.service";
import { emit } from "cluster";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const categoryRepository = AppDataSource.getRepository(Category);
const clientRepository = AppDataSource.getRepository(Client);
const userRepository = AppDataSource.getRepository(User);

export const createCategory = async (
    body: any,
    userId: number
) => {

    const {
        clientId,
        categoryName,
        description,
    } = body;

    const user = await userRepository.findOne({
        where: {
            userId,
        },
        relations: ["role", "client"],
    });

    if (!user) {
        throw new Error("User not found.");
    }

    if (
        user.role.name !== Role.SUPER_ADMIN &&
        user.role.name !== Role.CLIENT
    ) {
        throw new Error(
            "You are not authorized to create category."
        );
    }

    let client;

    if (user.role.name === Role.SUPER_ADMIN) {

        if (!clientId) {
            throw new Error("ClientId is required.");
        }

        client = await clientRepository.findOne({
            where: {
                clientId,
            },
        });

        if (!client) {
            throw new Error("Client not found.");
        }

    } else {

        client = user.client;

        if (!client) {
            throw new Error("Client not found.");
        }
    }

    const existing = await categoryRepository.findOne({
        where: {
            categoryName,
            client: {
                clientId: client.clientId,
            },
        },
        relations: ["client"],
    });

    if (existing) {
        throw new Error("Category already exists.");
    }

    const categoryCode = await generateCategoryCode();

    const category = categoryRepository.create({
        categoryCode,
        categoryName,
        description,
        client,
        createdBy: userId,
    });

    await categoryRepository.save(category);

    return {
        status: true,
        message: "Category created successfully.",
        data: category,
    };
};
export const getCategories = async () => {

    return await categoryRepository.find({
        relations: ["client"],
        order: {
            categoryId: "DESC",
        },
    });

};

export const getCategoryById = async (
    categoryId: number
) => {

    const category = await categoryRepository.findOne({
        where: {
            categoryId,
        },
        relations: ["client", "products"],
    });

    if (!category) {
        throw new Error("Category not found.");
    }

    return category;

};

export const updateCategory = async (
    categoryId: number,
    body: any,
    userId: number
) => {

    const category = await categoryRepository.findOne({
        where: {
            categoryId,
        },
    });

    if (!category) {
        throw new Error("Category not found.");
    }

    category.categoryName =
        body.categoryName ?? category.categoryName;

    category.description =
        body.description ?? category.description;

    category.updatedBy = userId;

    await categoryRepository.save(category);

    return category;

};

export const deleteCategory = async (
    categoryId: number
) => {

    const category = await categoryRepository.findOne({
        where: {
            categoryId,
        },
    });

    if (!category) {
        throw new Error("Category not found.");
    }

    await categoryRepository.remove(category);

    return true;

};

export const generateCategoryCode = async () => {

    const lastCategory = await categoryRepository.find({
        order: {
            categoryId: "DESC",
        },
        take: 1,
    });

    if (!lastCategory.length) {
        return "CAT000001";
    }

    const lastNumber = Number(
        lastCategory[0].categoryCode.replace("CAT", "")
    );

    return `CAT${String(lastNumber + 1).padStart(6, "0")}`;
};

export const generateCategoryXml = async (clientId: number) => {
    console.log("ClientId", clientId)
    const categories = await categoryRepository.find({
        where: {
            client: {
                clientId
            },
            isAsync: false
        },

    });
    console.log("categories", categories)


    if (!categories.length) {
        throw new Error("No unsynced categories found.");
    }


    const xml = generateCategoryXML(categories);

    const tallyResponse = await sendCategoryXmlToTally(
        xml
    );
    console.log("tallyResponse", tallyResponse)

    // Check Tally response before updating
    // Example condition (depends on Tally response format)
    if (tallyResponse) {

        await categoryRepository.update(
            {
                categoryId: In(
                    categories.map(
                        category => category.categoryId
                    )
                )
            },
            {
                isAsync: true
            }
        );

    }

    return {
        count: categories.length,
        xml,
        tallyResponse
    };
};

export const readCategoriesFromTallyService = async () => {
    const xml = generateReadCategoryXML();

    console.log("===== XML SENT TO TALLY =====");
    console.log(xml);

    const response = await axios.post(
        "http://192.168.1.108:9000",
        xml,
        {
            headers: {
                "Content-Type": "text/xml"
            }
        }
    );

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ""
    });

    const json = parser.parse(response.data);

    return json;
};