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
import { Invoice } from "../entities/Invoice";
import { InvoiceStatus } from "../utils/constants";
import { Order } from "../entities/Order";

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
  // WAITING SYNC RESULTS
  // =========================================================

  private pendingSyncResults = new Map<
    number,
    {
      resolve: (result: any) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

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

    console.log("CREATE SYNC JOB CALLED");

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

      // =======================================================
      // START WAITING BEFORE SENDING COMMAND
      // =======================================================

      const resultPromise =
        this.waitForSyncResult(
          savedJob.id
        );

      // =======================================================
      // SEND COMMAND TO .NET CONNECTOR
      // =======================================================

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

      // =======================================================
      // WAIT UNTIL .NET RETURNS FINAL RESULT
      // =======================================================

      const finalResult =
        await resultPromise;

      console.log(
        "Final Tally sync result received:",
        JSON.stringify(
          finalResult,
          null,
          2
        )
      );

      return finalResult;

    } catch (error: any) {

      console.error(
        "Tally sync failed:",
        error
      );

      // Remove pending waiter if it still exists
      const pending =
        this.pendingSyncResults.get(
          savedJob.id
        );

      if (pending) {

        clearTimeout(
          pending.timer
        );

        this.pendingSyncResults.delete(
          savedJob.id
        );
      }

      savedJob.status =
        TallySyncStatus.FAILED;

      savedJob.errorMessage =
        error?.message ||
        "Tally sync failed.";

      savedJob.completedAt =
        new Date();

      await this.tallySyncJobRepository.save(
        savedJob
      );

      throw new Error(
        error?.message ||
        "Tally sync failed."
      );
    }
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

    // =========================================================
    // EXPORT CATEGORIES
    // Node DB -> .NET
    // =========================================================

    if (
      job.type ===
      TallySyncType.EXPORT_CATEGORIES
    ) {

      const categoryRepository =
        AppDataSource.getRepository(Category);

      const categories =
        await categoryRepository.find({
          where: {
            client: {
              clientId: job.clientId,
            },
            isAsync: false,
          },
        });

      data = categories.map(
        (category) => ({
          categoryId:
            category.categoryId,

          categoryCode:
            category.categoryCode,

          categoryName:
            category.categoryName,

          description:
            category.description,

          isActive:
            category.isActive,
        })
      );
    }

    // =========================================================
    // EXPORT PRODUCTS
    // Node DB -> .NET
    // =========================================================

    if (
      job.type ===
      TallySyncType.EXPORT_PRODUCTS
    ) {

      const productRepository =
        AppDataSource.getRepository(Product);

      const products =
        await productRepository.find({
          where: {
            client: {
              clientId: job.clientId,
            },
            isAsync: false,
          },

          relations: {
            category: true,
          },
        });

      data = products.map(
        (product) => ({
          productId:
            product.productId,

          productCode:
            product.productCode,

          productName:
            product.productName,

          description:
            product.description,

          base_price:
            Number(product.base_price || 0),

          discount_percentage:
            Number(
              product.discount_percentage || 0
            ),

          discounted_price:
            product.discounted_price !== null
              ? Number(
                product.discounted_price
              )
              : null,

          currency:
            product.currency,

          is_active:
            product.is_active,

          unit_text:
            product.unit_text,

          min_delivery_days:
            product.min_delivery_days,

          max_delivery_days:
            product.max_delivery_days,

          category:
            product.category
              ? {
                categoryId:
                  product.category.categoryId,

                categoryCode:
                  product.category.categoryCode,

                categoryName:
                  product.category.categoryName,
              }
              : null,
        })
      );
    }

    // =========================================================
    // EXPORT INVOICES
    // Node DB -> .NET
    // =========================================================

    if (
      job.type ===
      TallySyncType.EXPORT_INVOICES
    ) {

      const invoiceRepository =
        AppDataSource.getRepository(Invoice);

      const invoices =
        await invoiceRepository.find({
          where: {
            order: {
              client: {
                clientId:
                  job.clientId,
              },
            },

            // IMPORTANT:
            // Only invoices which are not synced
            isAsync: false,
          },

          relations: {
            order: {
              subClient: true,
              client: true,

              items: {
                variant: {
                  product: true,
                },
              },
            },

            transactions: true,
          },
        });

      data = invoices.map(
        (invoice) => ({
          invoiceId:
            invoice.invoiceId,

          invoiceNumber:
            invoice.invoiceNumber,

          invoiceDate:
            invoice.created_at
              ? invoice.created_at
                .toISOString()
                .split("T")[0]
              : null,

          partyName:
            invoice.order?.subClient?.companyName ||
            invoice.order?.subClient?.contactPerson ||
            "",

          voucherType:
            "Sales",

          amount:
            Number(invoice.amount || 0),

          tax:
            Number(invoice.tax || 0),

          shippingAmount:
            Number(
              invoice.shipping_amount || 0
            ),

          items:
            invoice.order?.items?.map(
              (item) => ({
                productName:
                  item.variant?.product
                    ?.productName || "",

                quantity:
                  Number(item.quantity || 0),

                rate:
                  Number(item.price || 0),

                amount:
                  Number(item.total || 0),

                unit:
                  item.variant?.product
                    ?.unit_text || "",
              })
            ) || [],
        })
      );
    }

    // =========================================================
    // IMPORT TYPES
    //
    // Node does not send data for imports.
    // .NET gets data from Tally and sends it
    // to POST /sync/result.
    // =========================================================

    if (
      job.type ===
      TallySyncType.IMPORT_CATEGORIES ||
      job.type ===
      TallySyncType.IMPORT_PRODUCTS ||
      job.type ===
      TallySyncType.IMPORT_INVOICES
    ) {
      data = [];
    }

    // =========================================================
    // UPDATE JOB
    // =========================================================

    job.totalRecords =
      data.length;

    job.status =
      TallySyncStatus.RUNNING;

    job.startedAt =
      job.startedAt || new Date();

    await this.tallySyncJobRepository.save(
      job
    );

    // =========================================================
    // RETURN DATA TO .NET CONNECTOR
    // =========================================================

    return {
      jobId:
        job.id,

      clientId:
        job.clientId,

      deviceId:
        job.tallyDevice?.deviceId,

      type:
        job.type,

      status:
        job.status,

      totalRecords:
        job.totalRecords,

      processedRecords:
        job.processedRecords,

      failedRecords:
        job.failedRecords,

      errorMessage:
        job.errorMessage,

      startedAt:
        job.startedAt,

      completedAt:
        job.completedAt,

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

  // =========================================================
  // 8. SYNC RESULT
  // =========================================================

  async syncResult(body: any) {

    const {
      jobId,
      deviceId,
      type,
      data,
      error,
    } = body;

    console.log(
      "================================="
    );

    console.log(
      "SYNC RESULT RECEIVED"
    );

    console.log(
      "jobId:",
      jobId
    );

    console.log(
      "deviceId:",
      deviceId
    );

    console.log(
      "type:",
      type
    );

    console.log(
      "data:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    console.log(
      "================================="
    );

    // =========================================================
    // GET JOB
    // =========================================================

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
      throw new Error(
        "Sync job not found."
      );
    }

    // =========================================================
    // VALIDATE DEVICE
    // =========================================================

    if (
      job.tallyDevice?.deviceId !==
      deviceId
    ) {
      throw new Error(
        "Device does not belong to this sync job."
      );
    }

    // =========================================================
    // VALIDATE TYPE
    // =========================================================

    if (job.type !== type) {
      throw new Error(
        `Sync type mismatch. Job type is ${job.type}, but received ${type}.`
      );
    }

    const userId =
      job.createdBy?.userId;

    const entityName =
      type.includes("CATEGORIES")
        ? "Category"
        : type.includes("PRODUCTS")
          ? "Product"
          : type.includes("INVOICES")
            ? "Invoice"
            : "Tally";

    let result: any;

    // =========================================================
    // CONNECTOR-LEVEL ERROR
    // .NET CONNECTOR -> NODE
    // =========================================================

    if (error) {

      const errorMessage =
        typeof error === "string"
          ? error
          : error?.message ||
          "Connector sync failed.";

      const result = {
        total: 0,
        created: 0,
        updated: 0,
        alreadyExists: 0,
        failed: 1,

        records: [
          {
            status: "FAILED",
            error: errorMessage,
          },
        ],
      };

      // =======================================================
      // UPDATE JOB
      // =======================================================

      job.totalRecords = 0;

      job.processedRecords = 0;

      job.failedRecords = 1;

      job.status =
        TallySyncStatus.FAILED;

      job.errorMessage =
        errorMessage;

      job.completedAt =
        new Date();

      await this.tallySyncJobRepository.save(
        job
      );

      // =======================================================
      // FINAL RESPONSE
      // =======================================================

      const finalResult = {

        jobId:
          job.id,

        clientId:
          job.clientId,

        deviceId:
          job.tallyDevice.deviceId,

        type:
          job.type,

        status:
          job.status,

        message:
          `${entityName} sync failed.`,

        summary: {

          total:
            0,

          created:
            0,

          updated:
            0,

          alreadyExists:
            0,

          failed:
            1,
        },

        records:
          result.records,
      };

      // =======================================================
      // IMPORTANT:
      // RESOLVE THE ORIGINAL /SYNC REQUEST
      // =======================================================

      const pending =
        this.pendingSyncResults.get(
          job.id
        );

      if (pending) {

        clearTimeout(
          pending.timer
        );

        this.pendingSyncResults.delete(
          job.id
        );

        pending.resolve(
          finalResult
        );
      }

      return finalResult;
    }

    if (
      type ===
      TallySyncType.IMPORT_CATEGORIES
    ) {

      result =
        await this.importCategories(
          job.clientId,
          Array.isArray(data)
            ? data
            : [],
          userId
        );
    }

    // =========================================================
    // CATEGORY EXPORT
    // Node -> .NET -> Tally -> Node
    // =========================================================

    else if (
      type ===
      TallySyncType.EXPORT_CATEGORIES
    ) {

      result =
        await this.processCategoryExportResult(
          job.clientId,
          data
        );
    }

    // =========================================================
    // PRODUCT IMPORT
    // Tally -> .NET -> Node
    // =========================================================

    else if (
      type ===
      TallySyncType.IMPORT_PRODUCTS
    ) {

      result =
        await this.importProducts(
          job.clientId,
          Array.isArray(data)
            ? data
            : [],
          userId
        );
    }

    // =========================================================
    // PRODUCT EXPORT
    // Node -> .NET -> Tally -> Node
    // =========================================================

    else if (
      type ===
      TallySyncType.EXPORT_PRODUCTS
    ) {

      result =
        await this.processProductExportResult(
          job.clientId,
          data
        );
    }

    // =========================================================
    // INVOICE IMPORT
    // Tally -> .NET -> Node
    // =========================================================

    else if (
      type ===
      TallySyncType.IMPORT_INVOICES
    ) {

      result =
        await this.importInvoices(
          job.clientId,
          Array.isArray(data)
            ? data
            : [],
          userId
        );
    }

    // =========================================================
    // INVOICE EXPORT
    // Node -> .NET -> Tally -> Node
    // =========================================================

    else if (
      type ===
      TallySyncType.EXPORT_INVOICES
    ) {

      result =
        await this.processInvoiceExportResult(
          job.clientId,
          data
        );
    }

    // =========================================================
    // INVALID TYPE
    // =========================================================

    else {
      throw new Error(
        `Unsupported Tally sync type: ${type}`
      );
    }

    // =========================================================
    // UPDATE JOB
    // =========================================================

    job.totalRecords =
      result.total;

    job.processedRecords =
      result.created +
      result.updated +
      result.alreadyExists;

    job.failedRecords =
      result.failed;

    job.status =
      result.failed > 0
        ? TallySyncStatus.FAILED
        : TallySyncStatus.COMPLETED;

    job.errorMessage =
      result.failed > 0
        ? `${result.failed} record(s) failed during sync.`
        : null;

    job.completedAt =
      new Date();

    await this.tallySyncJobRepository.save(
      job
    );

    // =========================================================
    // GET ENTITY NAME
    // =========================================================



    // =========================================================
    // FINAL RESPONSE
    // =========================================================

    const finalResult = {

      jobId:
        job.id,

      clientId:
        job.clientId,

      deviceId:
        deviceId,

      type:
        job.type,

      status:
        job.status,

      message:
        result.failed > 0
          ? `${entityName} sync completed with errors.`
          : `${entityName} sync completed successfully.`,

      summary: {

        total:
          result.total,

        created:
          result.created,

        updated:
          result.updated,

        alreadyExists:
          result.alreadyExists,

        failed:
          result.failed,
      },

      records:
        result.records || [],
    };

    // =========================================================
    // RESOLVE /SYNC REQUEST
    // =========================================================

    const pending =
      this.pendingSyncResults.get(
        job.id
      );

    if (pending) {

      clearTimeout(
        pending.timer
      );

      this.pendingSyncResults.delete(
        job.id
      );

      pending.resolve(
        finalResult
      );
    }

    return finalResult;
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
    let failed = 0;

    const records: any[] = [];

    for (const tallyCategory of categories) {

      const categoryName =
        (
          tallyCategory.Name ??
          (tallyCategory as any).name
        )?.trim();

      try {

        // =====================================================
        // VALIDATION
        // =====================================================

        if (!categoryName) {

          failed++;

          records.push({
            categoryId: null,
            categoryCode: null,
            categoryName: null,

            status: "FAILED",

            message:
              "Category name is missing.",

            error:
              "Category name is required.",
          });

          continue;
        }

        const description =
          (
            tallyCategory.Description ??
            (tallyCategory as any).description
          )?.trim() || null;

        // =====================================================
        // FIND EXISTING
        // =====================================================

        const existingCategory =
          await categoryRepository.findOne({
            where: {
              client: {
                clientId,
              },

              categoryName,
            },
          });

        // =====================================================
        // UPDATE
        // =====================================================

        if (existingCategory) {

          existingCategory.description =
            description;

          existingCategory.isAsync =
            true;

          existingCategory.updatedBy =
            userId;

          await categoryRepository.save(
            existingCategory
          );

          updated++;

          records.push({
            categoryId:
              existingCategory.categoryId,

            categoryCode:
              existingCategory.categoryCode,

            categoryName:
              existingCategory.categoryName,

            status:
              "UPDATED",

            message:
              `Category "${categoryName}" updated successfully from Tally.`,
          });

          continue;
        }

        // =====================================================
        // CREATE
        // =====================================================

        const categoryCode =
          await generateCategoryCode();

        const newCategory =
          categoryRepository.create({
            client: {
              clientId,
            },

            categoryCode,

            categoryName,

            description,

            isAsync: true,

            isActive: true,

            createdBy:
              userId,

            updatedBy:
              null,
          });

        await categoryRepository.save(
          newCategory
        );

        created++;

        records.push({
          categoryId:
            newCategory.categoryId,

          categoryCode:
            newCategory.categoryCode,

          categoryName:
            newCategory.categoryName,

          status:
            "CREATED",

          message:
            `Category "${categoryName}" created successfully from Tally.`,
        });

      } catch (error: any) {

        failed++;

        records.push({
          categoryId: null,

          categoryCode: null,

          categoryName:
            categoryName || null,

          status:
            "FAILED",

          message:
            `Category "${categoryName || ""}" failed to import.`,

          error:
            error?.message ||
            "Unknown server error.",
        });
      }
    }

    return {

      total:
        categories.length,

      created,

      updated,

      alreadyExists:
        0,

      failed,

      processed:
        created +
        updated,

      records,
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

    let created = 0;
    let updated = 0;
    let alreadyExists = 0;
    let failed = 0;

    const records: any[] = [];

    for (const result of results) {

      try {

        const categoryCode =
          result.categoryCode?.trim();

        const categoryName =
          result.categoryName?.trim();

        // =====================================================
        // CATEGORY CODE MISSING
        // =====================================================

        if (!categoryCode) {

          failed++;

          records.push({
            categoryId:
              result.categoryId ?? null,

            categoryCode:
              null,

            categoryName:
              categoryName || null,

            status:
              "FAILED",

            message:
              "Category code is missing in export result.",

            error:
              "Category code is missing.",
          });

          continue;
        }

        // =====================================================
        // FIND CATEGORY
        // =====================================================

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

          records.push({
            categoryId:
              result.categoryId ?? null,

            categoryCode,

            categoryName:
              categoryName || null,

            status:
              "FAILED",

            message:
              `Category "${categoryName || categoryCode}" was not found.`,

            error:
              `Category ${categoryCode} not found for client ${clientId}.`,
          });

          continue;
        }

        // =====================================================
        // CREATED
        // =====================================================

        if (
          result.status === "CREATED"
        ) {

          category.isAsync =
            true;

          await categoryRepository.save(
            category
          );

          created++;

          records.push({
            categoryId:
              category.categoryId,

            categoryCode:
              category.categoryCode,

            categoryName:
              category.categoryName,

            status:
              "CREATED",

            message:
              `Category "${category.categoryName}" created successfully in Tally.`,
          });

          continue;
        }

        // =====================================================
        // EXISTS
        // =====================================================

        if (
          result.status === "EXISTS"
        ) {

          category.isAsync =
            true;

          await categoryRepository.save(
            category
          );

          alreadyExists++;

          records.push({
            categoryId:
              category.categoryId,

            categoryCode:
              category.categoryCode,

            categoryName:
              category.categoryName,

            status:
              "EXISTS",

            message:
              `Category "${category.categoryName}" already exists in Tally.`,
          });

          continue;
        }

        // =====================================================
        // UPDATED
        // =====================================================

        if (
          result.status === "UPDATED" ||
          result.status === "ALTERED"
        ) {

          category.isAsync =
            true;

          await categoryRepository.save(
            category
          );

          updated++;

          records.push({
            categoryId:
              category.categoryId,

            categoryCode:
              category.categoryCode,

            categoryName:
              category.categoryName,

            status:
              "UPDATED",

            message:
              `Category "${category.categoryName}" updated successfully in Tally.`,
          });

          continue;
        }

        // =====================================================
        // FAILED
        // =====================================================

        if (
          result.status === "FAILED"
        ) {

          failed++;

          records.push({
            categoryId:
              category.categoryId,

            categoryCode:
              category.categoryCode,

            categoryName:
              category.categoryName,

            status:
              "FAILED",

            message:
              `Category "${category.categoryName}" failed to sync.`,

            error:
              result.error ||
              "Unknown error returned by Tally Connector.",
          });

          continue;
        }

        // =====================================================
        // UNKNOWN STATUS
        // =====================================================

        failed++;

        records.push({
          categoryId:
            category.categoryId,

          categoryCode:
            category.categoryCode,

          categoryName:
            category.categoryName,

          status:
            "FAILED",

          message:
            `Unknown sync status for category "${category.categoryName}".`,

          error:
            `Unknown status: ${result.status}`,
        });

      } catch (error: any) {

        failed++;

        records.push({
          categoryId:
            result.categoryId ?? null,

          categoryCode:
            result.categoryCode ?? null,

          categoryName:
            result.categoryName ?? null,

          status:
            "FAILED",

          message:
            "Unexpected error while processing category sync result.",

          error:
            error?.message ||
            "Unknown server error.",
        });
      }
    }

    return {

      total:
        results.length,

      created,

      updated,

      alreadyExists,

      failed,

      processed:
        created +
        updated +
        alreadyExists,

      records,
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
    let failed = 0;

    const records: any[] = [];

    for (const tallyProduct of products) {
      try {

        // =====================================================
        // 1. VALIDATE PRODUCT NAME
        // =====================================================

        const productName =
          tallyProduct.name?.trim();

        if (!productName) {

          failed++;

          records.push({
            productId: null,

            productName: null,

            status:
              "FAILED",

            message:
              "Product name is missing.",

            error:
              "Product name is required.",
          });

          continue;
        }

        // =====================================================
        // 2. GET TALLY PARENT / CATEGORY
        // =====================================================

        const categoryName =
          tallyProduct.parent?.trim();

        if (!categoryName) {

          failed++;

          records.push({
            productId: null,

            productName,

            status:
              "FAILED",

            message:
              `Product "${productName}" failed to import.`,

            error:
              "Category/Parent is missing.",
          });

          continue;
        }

        // =====================================================
        // 3. FIND CATEGORY
        // =====================================================

        let category =
          await categoryRepository.findOne({
            where: {
              client: {
                clientId,
              },

              categoryName,
            },
          });

        // =====================================================
        // 4. CATEGORY DOES NOT EXIST
        //    CREATE CATEGORY
        // =====================================================

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

              description:
                null,

              isAsync:
                true,

              isActive:
                true,

              createdBy:
                userId,

              updatedBy:
                null,
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

        // =====================================================
        // 5. FIND EXISTING PRODUCT
        // =====================================================

        const existingProduct =
          await productRepository.findOne({
            where: {
              client: {
                clientId,
              },

              productName,
            },
          });

        // =====================================================
        // 6. UPDATE EXISTING PRODUCT
        // =====================================================

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
              Number(
                tallyProduct.rate
              );
          }

          // Assign Category relation
          existingProduct.category =
            category;

          // Imported from Tally
          existingProduct.isAsync =
            true;

          existingProduct.updated_by =
            userId;

          await productRepository.save(
            existingProduct
          );

          updated++;

          records.push({
            productId:
              existingProduct.productId,

            productName:
              existingProduct.productName,

            status:
              "UPDATED",

            message:
              `Product "${productName}" updated successfully from Tally.`,
          });

          console.log(
            `Product updated: ${productName} | ` +
            `Category: ${category.categoryName} | ` +
            `Category ID: ${category.categoryId} | ` +
            `isAsync: true`
          );

          continue;
        }

        // =====================================================
        // 7. PRODUCT DOES NOT EXIST
        //    GENERATE PRODUCT CODE
        // =====================================================

        const productCode =
          await generateProductCode();

        // =====================================================
        // 8. CREATE PRODUCT
        // =====================================================

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
                ? Number(
                  tallyProduct.rate
                )
                : 0,

            discount_percentage:
              0,

            discounted_price:
              null,

            currency:
              "AUD",

            is_active:
              true,

            unit_text:
              tallyProduct.baseUnits?.trim() ||
              null,

            min_delivery_days:
              null,

            max_delivery_days:
              null,

            // Imported from Tally
            isAsync:
              true,

            // Category relation
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

        records.push({
          productId:
            newProduct.productId,

          productName:
            newProduct.productName,

          status:
            "CREATED",

          message:
            `Product "${productName}" created successfully from Tally.`,
        });

        console.log(
          `Product created: ${productName} | ` +
          `Product Code: ${productCode} | ` +
          `Category: ${category.categoryName} | ` +
          `Category ID: ${category.categoryId} | ` +
          `isAsync: true`
        );

      } catch (error: any) {

        failed++;

        records.push({
          productId: null,

          productName:
            tallyProduct?.name ||
            null,

          status:
            "FAILED",

          message:
            `Product "${tallyProduct?.name || ""}" failed to import.`,

          error:
            error?.message ||
            "Unknown server error.",
        });

        console.error(
          `Failed to import product "${tallyProduct?.name}":`,
          error?.message
        );
      }
    }

    // =====================================================
    // FINAL RESULT
    // =====================================================

    return {
      total:
        products.length,

      created,

      updated,

      alreadyExists:
        0,

      failed,

      processed:
        created +
        updated,

      records,
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

    const results =
      Array.isArray(data) ? data : [];

    let created = 0;
    let updated = 0;
    let alreadyExists = 0;
    let failed = 0;

    const records: any[] = [];

    for (const result of results) {

      try {

        const productId =
          Number(result.productId);

        if (!productId) {

          failed++;

          records.push({
            productId: result.productId ?? null,
            productName: result.productName ?? null,
            status: "FAILED",
            message: "Product ID is missing in export result.",
            error: "Product ID is missing.",
          });

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

          records.push({
            productId,
            productName: result.productName ?? null,
            status: "FAILED",
            message: `Product ${productId} was not found.`,
            error: `Product ${productId} not found for client ${clientId}.`,
          });

          continue;
        }

        // ============================================
        // CREATED
        // ============================================

        if (result.status === "CREATED") {

          product.isAsync = true;

          await productRepository.save(product);

          created++;

          records.push({
            productId: product.productId,
            productName: product.productName,
            status: "CREATED",
            message:
              `Product "${product.productName}" created successfully in Tally.`,
          });

          continue;
        }

        // ============================================
        // EXISTS
        // ============================================

        if (result.status === "EXISTS") {

          product.isAsync = true;

          await productRepository.save(product);

          alreadyExists++;

          records.push({
            productId: product.productId,
            productName: product.productName,
            status: "EXISTS",
            message:
              `Product "${product.productName}" already exists in Tally.`,
          });

          continue;
        }

        // ============================================
        // UPDATED / ALTERED
        // ============================================

        if (
          result.status === "UPDATED" ||
          result.status === "ALTERED"
        ) {

          product.isAsync = true;

          await productRepository.save(product);

          updated++;

          records.push({
            productId: product.productId,
            productName: product.productName,
            status: "UPDATED",
            message:
              `Product "${product.productName}" updated successfully in Tally.`,
          });

          continue;
        }

        // ============================================
        // FAILED
        // ============================================

        if (result.status === "FAILED") {

          failed++;

          records.push({
            productId: product.productId,
            productName: product.productName,
            status: "FAILED",
            message:
              `Product "${product.productName}" failed to sync.`,
            error:
              result.error ||
              "Unknown error returned by Tally Connector.",
          });

          continue;
        }

        // ============================================
        // UNKNOWN STATUS
        // ============================================

        failed++;

        records.push({
          productId: product.productId,
          productName: product.productName,
          status: "FAILED",
          message:
            `Unknown sync status for product "${product.productName}".`,
          error:
            `Unknown status: ${result.status}`,
        });

      } catch (error: any) {

        failed++;

        records.push({
          productId: result.productId ?? null,
          productName: result.productName ?? null,
          status: "FAILED",
          message:
            "Unexpected error while processing product sync result.",
          error:
            error?.message ||
            "Unknown server error.",
        });
      }
    }

    return {
      total: results.length,
      created,
      updated,
      alreadyExists,
      failed,
      processed:
        created +
        updated +
        alreadyExists,

      records,
    };
  }

  async importInvoices(
    clientId: number,
    invoices: Array<{
      invoiceNumber: string;
      invoiceDate: string;
      partyName: string;
      voucherType: string;
      amount: number;
      tax: number;
      items: Array<{
        productName: string;
        quantity: number;
        rate: number;
        amount: number;
        unit?: string;
      }>;
    }>,
    userId: number
  ) {
    const invoiceRepository =
      AppDataSource.getRepository(Invoice);

    const orderRepository =
      AppDataSource.getRepository(Order);

    let created = 0;
    let updated = 0;
    let failed = 0;

    const records: any[] = [];

    for (const tallyInvoice of invoices) {
      try {
        console.log(
          "[IMPORT] Invoice data received from Tally:",
          JSON.stringify(tallyInvoice, null, 2)
        );

        // =====================================================
        // 1. GET INVOICE NUMBER
        // =====================================================

        const invoiceNumber =
          tallyInvoice.invoiceNumber?.trim();

        // =====================================================
        // 2. VALIDATE INVOICE NUMBER
        // =====================================================

        if (!invoiceNumber) {
          failed++;

          records.push({
            invoiceId: null,
            invoiceNumber: null,
            status: "FAILED",
            message:
              "Invoice number is missing.",
            error:
              "Invoice number is required.",
          });

          continue;
        }

        console.log(
          `[IMPORT] Processing invoice: ${invoiceNumber}`
        );

        // =====================================================
        // 3. CHECK IF INVOICE ALREADY EXISTS
        // =====================================================

        const existingInvoice =
          await invoiceRepository.findOne({
            where: {
              invoiceNumber,

              order: {
                client: {
                  clientId,
                },
              },
            },

            relations: {
              order: true,
            },
          });

        // =====================================================
        // 4. UPDATE EXISTING INVOICE
        // =====================================================

        if (existingInvoice) {
          console.log(
            `[IMPORT] Invoice already exists: ${invoiceNumber}`
          );

          existingInvoice.amount =
            Number(
              tallyInvoice.amount || 0
            );

          existingInvoice.tax =
            Number(
              tallyInvoice.tax || 0
            );

          existingInvoice.isAsync =
            true;

          await invoiceRepository.save(
            existingInvoice
          );

          updated++;

          records.push({
            invoiceId:
              existingInvoice.invoiceId,

            invoiceNumber:
              existingInvoice.invoiceNumber,

            status:
              "UPDATED",

            message:
              `Invoice "${invoiceNumber}" updated successfully from Tally.`,
          });

          console.log(
            `[IMPORT] Invoice updated successfully: ${invoiceNumber}`
          );

          continue;
        }

        // =====================================================
        // 5. FIND MATCHING ORDER
        // =====================================================

        console.log(
          `[IMPORT] Invoice does not exist: ${invoiceNumber}`
        );

        const order =
          await orderRepository.findOne({
            where: {
              orderNumber:
                invoiceNumber,

              client: {
                clientId,
              },
            },

            relations: {
              client: true,
            },
          });

        // =====================================================
        // 6. ORDER NOT FOUND
        // =====================================================

        if (!order) {
          console.log(
            `[IMPORT] Order not found for invoice: ${invoiceNumber}`
          );

          failed++;

          records.push({
            invoiceId: null,

            invoiceNumber,

            status:
              "FAILED",

            message:
              `Invoice "${invoiceNumber}" failed to import.`,

            error:
              `Order "${invoiceNumber}" was not found for client ${clientId}.`,
          });

          continue;
        }

        console.log(
          `[IMPORT] Matching order found: ${order.orderId}`
        );

        // =====================================================
        // 7. CHECK IF ORDER ALREADY HAS INVOICE
        // =====================================================

        if (order.invoice) {
          console.log(
            `[IMPORT] Order ${order.orderId} already has an invoice`
          );

          failed++;

          records.push({
            invoiceId: null,

            invoiceNumber,

            status:
              "FAILED",

            message:
              `Invoice "${invoiceNumber}" failed to import.`,

            error:
              `Order ${order.orderId} already has an invoice.`,
          });

          continue;
        }

        // =====================================================
        // 8. CREATE NEW INVOICE
        // =====================================================

        const newInvoice =
          invoiceRepository.create({
            invoiceNumber,

            order,

            amount:
              Number(
                tallyInvoice.amount || 0
              ),

            tax:
              Number(
                tallyInvoice.tax || 0
              ),

            shipping_amount:
              Number(
                order.shipping_amount || 0
              ),

            status:
              InvoiceStatus.UNPAID,

            isAsync:
              true,
          });

        await invoiceRepository.save(
          newInvoice
        );

        created++;

        records.push({
          invoiceId:
            newInvoice.invoiceId,

          invoiceNumber:
            newInvoice.invoiceNumber,

          status:
            "CREATED",

          message:
            `Invoice "${invoiceNumber}" created successfully from Tally.`,
        });

        console.log(
          `[IMPORT] Invoice created successfully: ${invoiceNumber}`
        );

      } catch (error: any) {

        failed++;

        records.push({
          invoiceId: null,

          invoiceNumber:
            tallyInvoice?.invoiceNumber ||
            null,

          status:
            "FAILED",

          message:
            `Invoice "${tallyInvoice?.invoiceNumber || ""}" failed to import.`,

          error:
            error?.message ||
            "Unknown server error.",
        });

        console.error(
          `[IMPORT] Invoice import failed: ${tallyInvoice?.invoiceNumber}`,
          error?.message
        );
      }
    }

    console.log(
      `[IMPORT] Completed | Total: ${invoices.length} | Created: ${created} | Updated: ${updated} | Failed: ${failed}`
    );

    return {
      total:
        invoices.length,

      created,

      updated,

      alreadyExists:
        0,

      failed,

      processed:
        created +
        updated,

      records,
    };
  }

  async processInvoiceExportResult(
    clientId: number,
    data: any
  ) {

    const invoiceRepository =
      AppDataSource.getRepository(Invoice);

    const results =
      Array.isArray(data)
        ? data
        : [];

    let created = 0;
    let updated = 0;
    let alreadyExists = 0;
    let failed = 0;

    const records: any[] = [];

    for (const result of results) {

      try {

        const invoiceId =
          Number(result.invoiceId);

        const invoiceNumber =
          result.invoiceNumber?.trim();

        // =====================================================
        // VALIDATE INVOICE ID
        // =====================================================

        if (!invoiceId) {

          failed++;

          records.push({
            invoiceId:
              result.invoiceId ?? null,

            invoiceNumber:
              invoiceNumber || null,

            status:
              "FAILED",

            message:
              "Invoice ID is missing in export result.",

            error:
              "Invoice ID is required.",
          });

          continue;
        }

        // =====================================================
        // FIND INVOICE
        // =====================================================

        const invoice =
          await invoiceRepository.findOne({
            where: {
              invoiceId,

              order: {
                client: {
                  clientId,
                },
              },
            },

            relations: {
              order: true,
            },
          });

        if (!invoice) {

          failed++;

          records.push({
            invoiceId,

            invoiceNumber:
              invoiceNumber || null,

            status:
              "FAILED",

            message:
              `Invoice "${invoiceNumber || invoiceId}" was not found.`,

            error:
              `Invoice ${invoiceId} not found for client ${clientId}.`,
          });

          continue;
        }

        // =====================================================
        // CREATED
        // =====================================================

        if (
          result.status === "CREATED"
        ) {

          invoice.isAsync =
            true;

          await invoiceRepository.save(
            invoice
          );

          created++;

          records.push({
            invoiceId:
              invoice.invoiceId,

            invoiceNumber:
              invoice.invoiceNumber,

            status:
              "CREATED",

            message:
              `Invoice "${invoice.invoiceNumber}" created successfully in Tally.`,
          });

          continue;
        }

        // =====================================================
        // EXISTS
        // =====================================================

        if (
          result.status === "EXISTS"
        ) {

          invoice.isAsync =
            true;

          await invoiceRepository.save(
            invoice
          );

          alreadyExists++;

          records.push({
            invoiceId:
              invoice.invoiceId,

            invoiceNumber:
              invoice.invoiceNumber,

            status:
              "EXISTS",

            message:
              `Invoice "${invoice.invoiceNumber}" already exists in Tally.`,
          });

          continue;
        }

        // =====================================================
        // UPDATED
        // =====================================================

        if (
          result.status === "UPDATED" ||
          result.status === "ALTERED"
        ) {

          invoice.isAsync =
            true;

          await invoiceRepository.save(
            invoice
          );

          updated++;

          records.push({
            invoiceId:
              invoice.invoiceId,

            invoiceNumber:
              invoice.invoiceNumber,

            status:
              "UPDATED",

            message:
              `Invoice "${invoice.invoiceNumber}" updated successfully in Tally.`,
          });

          continue;
        }

        // =====================================================
        // FAILED
        // =====================================================

        if (
          result.status === "FAILED"
        ) {

          failed++;

          records.push({
            invoiceId:
              invoice.invoiceId,

            invoiceNumber:
              invoice.invoiceNumber,

            status:
              "FAILED",

            message:
              `Invoice "${invoice.invoiceNumber}" failed to sync.`,

            error:
              result.error ||
              "Unknown error returned by Tally Connector.",
          });

          continue;
        }

        // =====================================================
        // UNKNOWN STATUS
        // =====================================================

        failed++;

        records.push({
          invoiceId:
            invoice.invoiceId,

          invoiceNumber:
            invoice.invoiceNumber,

          status:
            "FAILED",

          message:
            `Unknown sync status for invoice "${invoice.invoiceNumber}".`,

          error:
            `Unknown status: ${result.status}`,
        });

      } catch (error: any) {

        failed++;

        records.push({
          invoiceId:
            result.invoiceId ?? null,

          invoiceNumber:
            result.invoiceNumber ?? null,

          status:
            "FAILED",

          message:
            "Unexpected error while processing invoice sync result.",

          error:
            error?.message ||
            "Unknown server error.",
        });
      }
    }

    return {

      total:
        results.length,

      created,

      updated,

      alreadyExists,

      failed,

      processed:
        created +
        updated +
        alreadyExists,

      records,
    };
  }

  // =========================================================
  // WAIT FOR SYNC RESULT
  // =========================================================

  private waitForSyncResult(
    jobId: number,
    timeoutMs = 5 * 60 * 1000
  ): Promise<any> {

    return new Promise((resolve, reject) => {

      const timer = setTimeout(() => {

        this.pendingSyncResults.delete(jobId);

        reject(
          new Error(
            `Sync job ${jobId} timed out. No result received from Tally Connector within 5 minutes.`
          )
        );

      }, timeoutMs);

      this.pendingSyncResults.set(
        jobId,
        {
          resolve,
          reject,
          timer,
        }
      );

    });
  }

}

export default new TallyService();