import { Request, Response } from "express";

import tallyService from "../services/tally.service";

import {
  TallySyncType,
  TallySyncStatus,
} from "../entities/TallySyncJob";
import { AuthRequest } from "../middleware/auth.middleware";

// =========================================================
// CREATE ACTIVATION CODE
// =========================================================

export const createActivationCode = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      clientId,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({
        status: false,
        message: "clientId is required.",
      });
    }

    const result =
      await tallyService.createActivationCode(
        Number(clientId)
      );

    return res.status(201).json({
      status: true,
      message:
        "Tally activation code created successfully.",
      data: result,
    });

  } catch (error: any) {

    return res.status(500).json({
      status: false,
      message:
        error.message ||
        "Failed to create activation code.",
    });
  }
}

// =========================================================
// ACTIVATE CONNECTOR
// =========================================================

export const activateConnector = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      activationCode,
      deviceName,
    } = req.body;

    if (!activationCode) {
      return res.status(400).json({
        status: false,
        message:
          "activationCode is required.",
      });
    }

    const result =
      await tallyService.activateConnector(
        activationCode,
        deviceName
      );

    return res.status(200).json({
      status: true,
      message:
        "Tally connector activated successfully.",
      data: result,
    });

  } catch (error: any) {

    return res.status(400).json({
      status: false,
      message:
        error.message ||
        "Failed to activate Tally connector.",
    });
  }
}

// =========================================================
// HEARTBEAT
// =========================================================

export const heartbeat = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      deviceId,
      tallyConnected,
      companyName,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        status: false,
        message:
          "deviceId is required.",
      });
    }

    const result =
      await tallyService.heartbeat(
        deviceId,
        Boolean(tallyConnected),
        companyName
      );

    return res.status(200).json({
      status: true,
      message:
        "Tally heartbeat received.",
      data: result,
    });

  } catch (error: any) {

    return res.status(400).json({
      status: false,
      message:
        error.message ||
        "Heartbeat failed.",
    });
  }
}

// =========================================================
// GET DEVICE STATUS
// =========================================================

export const getDeviceStatus = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      deviceId,
    } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        status: false,
        message:
          "deviceId is required.",
      });
    }

    const result =
      await tallyService.getDeviceStatus(
        String(deviceId)
      );

    return res.status(200).json({
      status: true,
      data: result,
    });

  } catch (error: any) {

    return res.status(404).json({
      status: false,
      message:
        error.message ||
        "Device not found.",
    });
  }
}

// =========================================================
// CREATE SYNC JOB
// =========================================================

export const createSyncJob = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const {
      clientId,
      deviceId,
      type,
    } = req.body;

    // Get logged-in user ID from JWT
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized. User ID not found.",
      });
    }

    if (!clientId) {
      return res.status(400).json({
        status: false,
        message: "clientId is required.",
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        status: false,
        message: "deviceId is required.",
      });
    }

    if (!type) {
      return res.status(400).json({
        status: false,
        message: "type is required.",
      });
    }

    if (
      !Object.values(TallySyncType).includes(type)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid sync type.",
        allowedTypes: Object.values(TallySyncType),
      });
    }

    const result =
      await tallyService.createSyncJob(
        Number(clientId),
        deviceId,
        type as TallySyncType,
        Number(userId)
      );

    return res.status(201).json({
      status: true,
      message: "Tally sync job created successfully.",
      data: result,
    });

  } catch (error: any) {
    return res.status(400).json({
      status: false,
      message:
        error.message ||
        "Failed to create sync job.",
    });
  }
};

// =========================================================
// GET SYNC JOB
// =========================================================

export const getSyncJob = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      jobId,
    } = req.params;

    if (!jobId) {
      return res.status(400).json({
        status: false,
        message:
          "jobId is required.",
      });
    }

    const result =
      await tallyService.getSyncJob(
        Number(jobId)
      );

    return res.status(200).json({
      status: true,
      data: result,
    });

  } catch (error: any) {

    return res.status(404).json({
      status: false,
      message:
        error.message ||
        "Sync job not found.",
    });
  }
}

// =========================================================
// UPDATE SYNC JOB
// =========================================================

export const updateSyncJob = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      jobId,
    } = req.params;

    const {
      status,
      totalRecords,
      processedRecords,
      failedRecords,
      errorMessage,
    } = req.body;

    if (!jobId) {
      return res.status(400).json({
        status: false,
        message:
          "jobId is required.",
      });
    }

    if (!status) {
      return res.status(400).json({
        status: false,
        message:
          "status is required.",
      });
    }

    if (
      !Object.values(
        TallySyncStatus
      ).includes(status)
    ) {
      return res.status(400).json({
        status: false,
        message:
          "Invalid sync status.",
      });
    }

    const result =
      await tallyService.updateSyncJob(
        Number(jobId),
        status as TallySyncStatus,
        totalRecords,
        processedRecords,
        failedRecords,
        errorMessage
      );

    return res.status(200).json({
      status: true,
      message:
        "Tally sync job updated successfully.",
      data: result,
    });

  } catch (error: any) {

    return res.status(400).json({
      status: false,
      message:
        error.message ||
        "Failed to update sync job.",
    });
  }
}

export const syncResult = async (
  req: AuthRequest,
  res: Response
) => {
  try {

    const result = await tallyService.syncResult(req.body);

    return res.status(200).json({
      status: true,
      message: "Sync result received successfully.",
      data: result,
    });

  } catch (error: any) {

    return res.status(500).json({
      status: false,
      message: error.message,
    });

  }
};
