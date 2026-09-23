import crypto from "crypto";
import axios from "axios"

import {
  TallyActivationCode,
} from "../entities/TallyActivationCode";

import {
  TallyDevice,
  TallyDeviceStatus,
} from "../entities/TallyDevice";

import {
  TallySyncJob,
  TallySyncStatus,
  TallySyncType,
} from "../entities/TallySyncJob";
import { AppDataSource } from "../database/data-source";
import { Product } from "../entities/Product";
import { Category } from "../entities/Category";
import { generateCategoryCode } from "./category.service";
import { generateProductCode } from "./product.service";

export class TallyService {

  private activationCodeRepository =
    AppDataSource.getRepository(
      TallyActivationCode
    );

  private tallyDeviceRepository =
    AppDataSource.getRepository(
      TallyDevice
    );

  private tallySyncJobRepository =
    AppDataSource.getRepository(
      TallySyncJob
    );

  // =========================================================
  // 1. CREATE ACTIVATION CODE
  // =========================================================

  async createActivationCode(
    clientId: number
  ) {

    // Check client indirectly by creating the code.
    // If you want, we can explicitly check Client
    // repository also.

    const activationCode =
      `TALLY-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}-${crypto
          .randomBytes(2)
          .toString("hex")
          .toUpperCase()}`;

    const activation =
      this.activationCodeRepository.create({
        clientId,
        activationCode,
        used: false,
        deviceId: null,
        usedAt: null,
      });

    const savedActivation =
      await this.activationCodeRepository.save(
        activation
      );

    return savedActivation;
  }

  // =========================================================
  // 2. ACTIVATE WINDOWS CONNECTOR
  // =========================================================

  async activateConnector(
    activationCode: string,
    deviceName?: string
  ) {

    const activation =
      await this.activationCodeRepository.findOne({
        where: {
          activationCode,
        },
      });

    if (!activation) {
      throw new Error(
        "Invalid activation code."
      );
    }

    if (activation.used) {
      throw new Error(
        "Activation code has already been used."
      );
    }

    // Generate unique connector/device ID
    const deviceId =
      crypto.randomUUID();

    // Generate secure authentication token
    const accessToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    // Create device
    const device =
      this.tallyDeviceRepository.create({
        clientId:
          activation.clientId,

        deviceId,

        deviceName:
          deviceName || null,

        accessToken,

        status:
          TallyDeviceStatus.OFFLINE,

        tallyConnected: false,

        companyName: null,

        lastSeenAt: null,
      });

    const savedDevice =
      await this.tallyDeviceRepository.save(
        device
      );

    // Mark activation code as used
    activation.used = true;
    activation.deviceId = savedDevice.id;
    activation.usedAt = new Date();

    await this.activationCodeRepository.save(
      activation
    );

    return {
      deviceId: savedDevice.deviceId,
      accessToken,
      clientId: savedDevice.clientId,
    };
  }

  // =========================================================
  // 3. CONNECTOR HEARTBEAT
  // =========================================================

  async heartbeat(
    deviceId: string,
    tallyConnected: boolean,
    companyName?: string
  ) {

    const device =
      await this.tallyDeviceRepository.findOne({
        where: {
          deviceId,
        },
      });

    if (!device) {
      throw new Error(
        "Tally device not found."
      );
    }

    device.status =
      TallyDeviceStatus.ONLINE;

    device.tallyConnected =
      tallyConnected;

    device.companyName =
      companyName || null;

    device.lastSeenAt =
      new Date();

    await this.tallyDeviceRepository.save(
      device
    );

    return {
      deviceId: device.deviceId,
      status: device.status,
      tallyConnected: device.tallyConnected,
      companyName: device.companyName,
      lastSeenAt: device.lastSeenAt,
    };
  }

  // =========================================================
  // 4. GET DEVICE STATUS
  // =========================================================

  async getDeviceStatus(
    deviceId: string
  ) {

    const device =
      await this.tallyDeviceRepository.findOne({
        where: {
          deviceId,
        },
      });

    if (!device) {
      throw new Error(
        "Tally device not found."
      );
    }

    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      status: device.status,
      tallyConnected: device.tallyConnected,
      companyName: device.companyName,
      lastSeenAt: device.lastSeenAt,
    };
  }

  // =========================================================
  // 5. CREATE SYNC JOB
  // =========================================================

  async createSyncJob(
    clientId: number,
    deviceId: string,
    type: TallySyncType,
    userId: number
  ) {

    console.log("🔥🔥🔥 CREATE SYNC JOB CALLED 🔥🔥🔥");

    console.log("clientId:", clientId);
    console.log("deviceId:", deviceId);
    console.log("type:", type);
    console.log("userId:", userId);


    // -------------------------------------------------------
    // CHECK DEVICE
    // -------------------------------------------------------

    const device =
      await this.tallyDeviceRepository.findOne({
        where: {
          deviceId,
          clientId,
        },
      });

    if (!device) {
      throw new Error(
        "Tally device not found for this client."
      );
    }

    // -------------------------------------------------------
    // CHECK CONNECTOR ONLINE
    // -------------------------------------------------------

    if (
      device.status !==
      TallyDeviceStatus.ONLINE
    ) {
      throw new Error(
        "Tally connector is offline."
      );
    }

    // -------------------------------------------------------
    // CREATE JOB
    // -------------------------------------------------------

    const job =
      this.tallySyncJobRepository.create({
        clientId,
        tallyDeviceId: device.id,

        type,

        createdBy: {
          userId: userId,
        },

        status:
          TallySyncStatus.PENDING,

        totalRecords: 0,
        processedRecords: 0,
        failedRecords: 0,

        errorMessage: null,

        startedAt: null,
        completedAt: null,
      });


    const savedJob =
      await this.tallySyncJobRepository.save(
        job
      );


    console.log(
      "Tally Sync Job Created:",
      savedJob.id
    );


    // -------------------------------------------------------
    // SEND COMMAND TO .NET CONNECTOR
    // -------------------------------------------------------

    try {

      console.log(
        "Sending command to connector..."
      );

      console.log({
        deviceId: device.deviceId,
        command: type,
        jobId: savedJob.id,
      });


      await this.sendTallyCommand(
        device.deviceId,
        {
          jobId: savedJob.id,
          command: type,
        }
      );


      console.log(
        "Command successfully sent to connector."
      );

    } catch (error: any) {

      console.error(
        "Failed to send command:",
        error
      );


      savedJob.status =
        TallySyncStatus.FAILED;

      savedJob.errorMessage =
        error?.message ||
        "Failed to send sync command to Tally connector.";

      await this.tallySyncJobRepository.save(
        savedJob
      );

      throw new Error(
        "Failed to send sync command to Tally connector."
      );
    }


    return {

      jobId:
        savedJob.id,

      clientId:
        savedJob.clientId,

      deviceId:
        device.deviceId,

      type:
        savedJob.type,

      status:
        savedJob.status,
    };
  }


  private async sendTallyCommand(
    deviceId: string,
    command: any
  ) {
    const tallyServerUrl =
      process.env.TALLY_SERVER_URL ||
      "http://localhost:5300";

    const url =
      `${tallyServerUrl}/api/tally/command`;

    await axios.post(
      url,
      {
        deviceId,
        jobId: command.jobId,
        command: command.command,
      }
    );
  }

  // =========================================================
  // 6. GET SYNC JOB
  // =========================================================

  async getSyncJob(
    jobId: number,
    clientId?: number
  ) {
    const where: any = {
      id: jobId,
    };

    if (clientId) {
      where.clientId = clientId;
    }

    const job =
      await this.tallySyncJobRepository.findOne({
        where,

        relations: {
          tallyDevice: true,
        },
      });

    if (!job) {
      throw new Error(
        "Tally sync job not found."
      );
    }

    let data: any[] = [];

    // ==========================================
    // EXPORT CATEGORIES
    // ==========================================

    if (job.type === TallySyncType.EXPORT_CATEGORIES) {

      const categoryRepository =
        AppDataSource.getRepository(Category);

      const categories =
        await categoryRepository.find({
          where: {
            client: {
              clientId: job.clientId,
            },
          },
        });

      data = categories.map((category) => ({
        categoryCode: category.categoryCode,
        categoryName: category.categoryName,
        description: category.description,
        isActive: category.isActive,
      }));
    }

    // ==========================================
    // EXPORT PRODUCTS
    // ==========================================

    if (job.type === TallySyncType.EXPORT_PRODUCTS) {

      const productRepository =
        AppDataSource.getRepository(Product);

      const products =
        await productRepository.find({
          where: {
            client: {
              clientId: job.clientId,
            },
          },

          relations: {
            category: true,
          },
        });

      data = products.map((product) => ({
        productCode: product.productCode,
        productName: product.productName,
        description: product.description,
        basePrice: Number(product.base_price),
        discountPercentage:
          Number(product.discount_percentage),
        discountedPrice:
          product.discounted_price !== null
            ? Number(product.discounted_price)
            : null,
        currency: product.currency,
        isActive: product.is_active,
        unit: product.unit_text,
        minDeliveryDays:
          product.min_delivery_days,
        maxDeliveryDays:
          product.max_delivery_days,

        categoryCode:
          product.category?.categoryCode,

        categoryName:
          product.category?.categoryName,
      }));
    }

    return {
      jobId: job.id,
      clientId: job.clientId,
      deviceId: job.tallyDevice?.deviceId,
      type: job.type,
      status: job.status,

      totalRecords: job.totalRecords,
      processedRecords: job.processedRecords,
      failedRecords: job.failedRecords,

      errorMessage: job.errorMessage,

      startedAt: job.startedAt,
      completedAt: job.completedAt,

      // Export data
      data,
    };
  }
  // =========================================================
  // 7. UPDATE SYNC JOB
  // =========================================================

  async updateSyncJob(
    jobId: number,
    status: TallySyncStatus,
    totalRecords?: number,
    processedRecords?: number,
    failedRecords?: number,
    errorMessage?: string
  ) {

    const job =
      await this.tallySyncJobRepository.findOne({
        where: {
          id: jobId,
        },
      });

    if (!job) {
      throw new Error(
        "Tally sync job not found."
      );
    }

    job.status = status;

    if (
      totalRecords !== undefined
    ) {
      job.totalRecords =
        totalRecords;
    }

    if (
      processedRecords !== undefined
    ) {
      job.processedRecords =
        processedRecords;
    }

    if (
      failedRecords !== undefined
    ) {
      job.failedRecords =
        failedRecords;
    }

    if (
      errorMessage !== undefined
    ) {
      job.errorMessage =
        errorMessage;
    }

    if (
      status ===
      TallySyncStatus.RUNNING
    ) {
      job.startedAt =
        new Date();
    }

    if (
      status ===
      TallySyncStatus.COMPLETED ||
      status ===
      TallySyncStatus.FAILED
    ) {
      job.completedAt =
        new Date();
    }

    return this.tallySyncJobRepository.save(
      job
    );
  }

  async syncResult(body: any) {
    const {
      jobId,
      deviceId,
      type,
      data,
      totalRecords = 0,
      processedRecords = 0,
      failedRecords = 0,
    } = body;

    console.log("sync result called");

    const job =
      await this.tallySyncJobRepository.findOne({
        where: {
          id: jobId,
        },
        relations: {
          tallyDevice: true,
          createdBy: true,
        },
      });

    if (!job) {
      throw new Error("Sync job not found.");
    }

    const userId = job.createdBy?.userId;

    if (
      job.tallyDevice?.deviceId !== deviceId
    ) {
      throw new Error(
        "Device does not belong to this sync job."
      );
    }

    console.log("=================================");
    console.log(`Tally Sync Job: ${jobId}`);
    console.log(`Type: ${type}`);
    console.log("=================================");

    // =========================================================
    // CATEGORY IMPORT
    // Tally -> .NET -> Node
    // =========================================================

    if (type === "IMPORT_CATEGORIES") {
      const importResult =
        await this.importCategories(
          job.clientId,
          data,
          userId
        );

      job.totalRecords =
        importResult.total;

      job.processedRecords =
        importResult.created +
        importResult.updated;

      job.failedRecords =
        importResult.failed;

      job.status =
        importResult.failed > 0
          ? TallySyncStatus.FAILED
          : TallySyncStatus.COMPLETED;

      job.completedAt =
        new Date();

      await this.tallySyncJobRepository.save(
        job
      );

      return {
        jobId,
        deviceId,
        type,
        status: job.status,
        ...importResult,
      };
    }

    // =========================================================
    // CATEGORY EXPORT
    // Node -> .NET -> Tally -> Node
    // =========================================================

    if (type === "EXPORT_CATEGORIES") {
      const exportResult =
        await this.processCategoryExportResult(
          job.clientId,
          data
        );

      job.totalRecords =
        exportResult.total;

      job.processedRecords =
        exportResult.processed;

      job.failedRecords =
        exportResult.failed;

      job.status =
        exportResult.failed > 0
          ? TallySyncStatus.FAILED
          : TallySyncStatus.COMPLETED;

      job.completedAt =
        new Date();

      await this.tallySyncJobRepository.save(
        job
      );

      return {
        jobId,
        deviceId,
        type,
        status: job.status,
        totalRecords:
          exportResult.total,
        processedRecords:
          exportResult.processed,
        failedRecords:
          exportResult.failed,
      };
    }

    // =========================================================
    // PRODUCT IMPORT
    // Tally -> .NET -> Node
    // =========================================================

    if (type === "IMPORT_PRODUCTS") {

      console.log("========== IMPORT_PRODUCTS DATA ==========");
      console.log("Data type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      console.log("Data:", JSON.stringify(data, null, 2));
      console.log("==========================================");
      const importResult =
        await this.importProducts(
          job.clientId,
          data,
          userId
        );

      job.totalRecords =
        importResult.total;

      job.processedRecords =
        importResult.created +
        importResult.updated;

      job.failedRecords =
        importResult.failed;

      job.status =
        importResult.failed > 0
          ? TallySyncStatus.FAILED
          : TallySyncStatus.COMPLETED;

      job.completedAt =
        new Date();

      await this.tallySyncJobRepository.save(
        job
      );

      return {
        jobId,
        deviceId,
        type,
        status: job.status,
        ...importResult,
      };
    }

    // =========================================================
    // PRODUCT EXPORT
    // Node -> .NET -> Tally -> Node
    // =========================================================

    if (type === "EXPORT_PRODUCTS") {
      const exportResult =
        await this.processProductExportResult(
          job.clientId,
          data
        );

      job.totalRecords =
        exportResult.total;

      job.processedRecords =
        exportResult.processed;

      job.failedRecords =
        exportResult.failed;

      job.status =
        exportResult.failed > 0
          ? TallySyncStatus.FAILED
          : TallySyncStatus.COMPLETED;

      job.completedAt =
        new Date();

      await this.tallySyncJobRepository.save(
        job
      );

      return {
        jobId,
        deviceId,
        type,
        status: job.status,
        totalRecords:
          exportResult.total,
        processedRecords:
          exportResult.processed,
        failedRecords:
          exportResult.failed,
      };
    }

    // =========================================================
    // OTHER SYNC TYPES
    // =========================================================

    job.totalRecords =
      totalRecords;

    job.processedRecords =
      processedRecords;

    job.failedRecords =
      failedRecords;

    job.status =
      failedRecords > 0
        ? TallySyncStatus.FAILED
        : TallySyncStatus.COMPLETED;

    job.completedAt =
      new Date();

    await this.tallySyncJobRepository.save(
      job
    );

    return {
      jobId,
      deviceId,
      type,
      status: job.status,
      totalRecords,
      processedRecords,
      failedRecords,
    };
  }

  async importCategories(
    clientId: number,
    categories: Array<{
      Name: string;
      Parent?: string | null;
      Description?: string | null;
    }>,
    userId: number
  ) {
    const categoryRepository =
      AppDataSource.getRepository(Category);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const tallyCategory of categories) {
      try {
        // =======================================================
        // VALIDATE CATEGORY NAME
        // =======================================================

        const categoryName =
          (tallyCategory.Name ?? (tallyCategory as any).name)?.trim();

        if (!categoryName) {
          skipped++;

          console.warn(
            "Skipping Tally category because name is empty."
          );

          continue;
        }

        // =======================================================
        // GENERATE CATEGORY CODE
        // =======================================================

        const categoryCode =
          await generateCategoryCode();

        // =======================================================
        // FIND EXISTING CATEGORY
        // =======================================================

        const existingCategory =
          await categoryRepository.findOne({
            where: {
              client: {
                clientId,
              },
              categoryName,
            },
          });

        // =======================================================
        // UPDATE EXISTING CATEGORY
        // =======================================================

        if (existingCategory) {
          existingCategory.categoryName =
            categoryName;

          existingCategory.description =
            (tallyCategory.Description ?? (tallyCategory as any).description)?.trim() ||
            null;

          existingCategory.isAsync =
            true;

          existingCategory.updatedBy =
            userId;

          await categoryRepository.save(
            existingCategory
          );

          updated++;

          console.log(
            `Category updated: ${categoryName}`
          );

          continue;
        }

        // =======================================================
        // CREATE NEW CATEGORY
        // =======================================================

        const newCategory =
          categoryRepository.create({
            client: {
              clientId,
            },

            categoryCode,

            categoryName,

            description:
              (tallyCategory.Description ?? (tallyCategory as any).description)?.trim() ||
              null,

            isAsync: true,

            isActive: true,

            createdBy: userId,

            updatedBy: null,
          });

        await categoryRepository.save(
          newCategory
        );

        created++;

        console.log(
          `Category created: ${categoryName}`
        );

      } catch (error: any) {
        failed++;

        console.error(
          `Failed to import category "${tallyCategory?.Name}":`,
          error?.message
        );
      }
    }

    return {
      total: categories.length,
      created,
      updated,
      skipped,
      failed,
    };
  }

  async processCategoryExportResult(
    clientId: number,
    data: any
  ) {
    const categoryRepository =
      AppDataSource.getRepository(Category);

    const results =
      Array.isArray(data)
        ? data
        : [];

    let processed = 0;
    let failed = 0;

    for (const result of results) {
      try {
        const categoryCode =
          result.categoryCode?.trim();

        if (!categoryCode) {
          failed++;

          console.error(
            "Category code missing in export result."
          );

          continue;
        }

        const category =
          await categoryRepository.findOne({
            where: {
              categoryCode,
              client: {
                clientId,
              },
            },
          });

        if (!category) {
          failed++;

          console.error(
            `Category not found: ${categoryCode}`
          );

          continue;
        }

        // Tally already had the category
        // OR .NET successfully created it.
        if (
          result.status === "EXISTS" ||
          result.status === "CREATED"
        ) {
          category.isAsync = true;

          await categoryRepository.save(
            category
          );

          processed++;

          console.log(
            `Category synced: ${category.categoryName} | ${result.status}`
          );

          continue;
        }

        // Tally creation failed
        if (result.status === "FAILED") {
          failed++;

          console.error(
            `Category export failed: ${category.categoryName} | ${result.error ?? "Unknown error"
            }`
          );

          continue;
        }

        failed++;

        console.error(
          `Unknown category export status: ${result.status}`
        );

      } catch (error: any) {
        failed++;

        console.error(
          "Failed to process category export result:",
          error?.message
        );
      }
    }

    return {
      total: results.length,
      processed,
      failed,
    };
  }

  async importProducts(
    clientId: number,
    products: Array<{
      name: string;
      parent: string;
      baseUnits: string;
      description: string;
      openingBalance?: number | null;
      closingBalance?: number | null;
      rate?: number | null;
    }>,
    userId: number
  ) {
    const productRepository =
      AppDataSource.getRepository(Product);

    const categoryRepository =
      AppDataSource.getRepository(Category);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const tallyProduct of products) {
      try {
        // =========================================================
        // 1. VALIDATE PRODUCT NAME
        // =========================================================

        const productName =
          tallyProduct.name?.trim();

        if (!productName) {
          skipped++;

          console.warn(
            "Skipping Tally product because name is empty."
          );

          continue;
        }

        // =========================================================
        // 2. GET TALLY PARENT / CATEGORY NAME
        // =========================================================

        const categoryName =
          tallyProduct.parent?.trim();

        if (!categoryName) {
          failed++;

          console.error(
            `Category/Parent missing for product: ${productName}`
          );

          continue;
        }

        // =========================================================
        // 3. FIND CATEGORY
        // =========================================================

        let category =
          await categoryRepository.findOne({
            where: {
              client: {
                clientId,
              },
              categoryName,
            },
          });

        // =========================================================
        // 4. CATEGORY DOES NOT EXIST -> CREATE IT
        // =========================================================

        if (!category) {
          console.log(
            `Category "${categoryName}" not found. Creating it...`
          );

          const categoryCode =
            await generateCategoryCode();

          const newCategory =
            categoryRepository.create({
              client: {
                clientId,
              },

              categoryCode,

              categoryName,

              description: null,

              isAsync: true,

              isActive: true,

              createdBy: userId,

              updatedBy: null,
            });

          category =
            await categoryRepository.save(
              newCategory
            );

          console.log(
            `Category created: ${categoryName} | ID: ${category.categoryId}`
          );
        } else {
          console.log(
            `Category found: ${categoryName} | ID: ${category.categoryId}`
          );
        }

        // =========================================================
        // 5. FIND EXISTING PRODUCT
        //
        // DO NOT generate a new productCode before this.
        // =========================================================

        const existingProduct =
          await productRepository.findOne({
            where: {
              client: {
                clientId,
              },
              productName,
            },
          });

        // =========================================================
        // 6. UPDATE EXISTING PRODUCT
        // =========================================================

        if (existingProduct) {
          existingProduct.productName =
            productName;

          existingProduct.description =
            tallyProduct.description?.trim() ||
            null;

          existingProduct.unit_text =
            tallyProduct.baseUnits?.trim() ||
            null;

          if (
            tallyProduct.rate !== null &&
            tallyProduct.rate !== undefined
          ) {
            existingProduct.base_price =
              Number(tallyProduct.rate);
          }

          // IMPORTANT:
          // Store the actual Category entity / FK
          existingProduct.category =
            category;

          // IMPORTANT:
          // Product was synchronized from Tally
          existingProduct.isAsync =
            true;

          existingProduct.updated_by =
            userId;

          await productRepository.save(
            existingProduct
          );

          updated++;

          console.log(
            `Product updated: ${productName} | ` +
            `Category: ${category.categoryName} | ` +
            `Category ID: ${category.categoryId} | ` +
            `isAsync: true`
          );

          continue;
        }

        // =========================================================
        // 7. PRODUCT DOES NOT EXIST -> GENERATE CODE
        // =========================================================

        const productCode =
          await generateProductCode();

        // =========================================================
        // 8. CREATE PRODUCT
        // =========================================================

        const newProduct =
          productRepository.create({
            client: {
              clientId,
            },

            productCode,

            productName,

            description:
              tallyProduct.description?.trim() ||
              null,

            base_price:
              tallyProduct.rate !== null &&
                tallyProduct.rate !== undefined
                ? Number(tallyProduct.rate)
                : 0,

            discount_percentage: 0,

            discounted_price: null,

            currency: "AUD",

            is_active: true,

            unit_text:
              tallyProduct.baseUnits?.trim() ||
              null,

            min_delivery_days: null,

            max_delivery_days: null,

            // IMPORTANT
            isAsync: true,

            // IMPORTANT
            // This stores Category FK through the relation
            category,

            created_by:
              userId,

            updated_by:
              null,
          });

        await productRepository.save(
          newProduct
        );

        created++;

        console.log(
          `Product created: ${productName} | ` +
          `Product Code: ${productCode} | ` +
          `Category: ${category.categoryName} | ` +
          `Category ID: ${category.categoryId} | ` +
          `isAsync: true`
        );

      } catch (error: any) {
        failed++;

        console.error(
          `Failed to import product "${tallyProduct?.name}":`,
          error?.message
        );
      }
    }

    return {
      total: products.length,
      created,
      updated,
      skipped,
      failed,
    };
  }

  async processProductExportResult(
    clientId: number,
    data: any
  ) {
    console.log("=================================");
    console.log("PRODUCT EXPORT RESULT RECEIVED");
    console.log("clientId:", clientId);
    console.log("data:", JSON.stringify(data, null, 2));
    console.log("=================================");

    const productRepository =
      AppDataSource.getRepository(Product);

    const results = Array.isArray(data) ? data : [];

    let processed = 0;
    let failed = 0;

    for (const result of results) {
      console.log("Processing result:", result);

      try {
        const productId = Number(result.productId);

        console.log("productId:", productId);
        console.log("status:", result.status);

        if (!productId) {
          failed++;
          console.error("Product ID missing in export result.");
          continue;
        }

        const product =
          await productRepository.findOne({
            where: {
              productId,
              client: {
                clientId,
              },
            },
          });

        if (!product) {
          failed++;
          console.error(`Product not found: ${productId}`);
          continue;
        }

        console.log(
          "BEFORE UPDATE:",
          product.productId,
          product.productName,
          "isAsync:",
          product.isAsync
        );

        if (
          result.status === "EXISTS" ||
          result.status === "CREATED"
        ) {
          product.isAsync = true;

          console.log(
            "SETTING isAsync = true for:",
            product.productName
          );

          await productRepository.save(product);

          console.log(
            "AFTER SAVE:",
            product.productId,
            product.productName,
            "isAsync:",
            product.isAsync
          );

          processed++;
          continue;
        }

        if (result.status === "FAILED") {
          failed++;

          console.error(
            `Product export failed: ${product.productName} | ${result.error ?? "Unknown error"
            }`
          );

          continue;
        }

        failed++;

        console.error(
          `Unknown product export status: ${result.status}`
        );

      } catch (error: any) {
        failed++;

        console.error(
          "Failed to process product export result:",
          error?.message
        );
      }
    }

    console.log(
      "PRODUCT EXPORT PROCESSING COMPLETE",
      {
        total: results.length,
        processed,
        failed,
      }
    );

    return {
      total: results.length,
      processed,
      failed,
    };
  }

}

export default new TallyService();