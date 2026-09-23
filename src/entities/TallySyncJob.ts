import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

import { BaseEntity } from "./BaseEntity";
import { Client } from "./Client";
import { TallyDevice } from "./TallyDevice";

export enum TallySyncType {
  EXPORT_CATEGORIES = "EXPORT_CATEGORIES",
  IMPORT_CATEGORIES = "IMPORT_CATEGORIES",

  EXPORT_PRODUCTS = "EXPORT_PRODUCTS",
  IMPORT_PRODUCTS = "IMPORT_PRODUCTS",
}

export enum TallySyncStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Entity("tally_sync_jobs")
export class TallySyncJob extends BaseEntity {

  @PrimaryGeneratedColumn()
  id: number;

  /**
   * B2B client.
   */
  @Column()
  @Index()
  clientId: number;

  @ManyToOne(
    () => Client,
    (client) => client.tallySyncJobs,
    {
      onDelete: "CASCADE",
    }
  )
  @JoinColumn({
    name: "clientId",
  })
  client: Client;


  /**
   * Tally connector that will execute this job.
   */
  @Column()
  @Index()
  tallyDeviceId: number;

  @ManyToOne(
    () => TallyDevice,
    (device) => device.syncJobs,
    {
      onDelete: "CASCADE",
    }
  )
  @JoinColumn({
    name: "tallyDeviceId",
  })
  tallyDevice: TallyDevice;

  /**
   * What type of data should be synchronized?
   */
  @Column({
    type: "enum",
    enum: TallySyncType,
  })
  type: TallySyncType;

  /**
   * Current job status.
   */
  @Column({
    type: "enum",
    enum: TallySyncStatus,
    default: TallySyncStatus.PENDING,
  })
  status: TallySyncStatus;

  @Column({
    type: "json",
    nullable: true,
  })
  payload: any;

  /**
   * Number of records received from Tally.
   */
  @Column({
    default: 0,
  })
  totalRecords: number;

  /**
   * Number of records successfully processed.
   */
  @Column({
    default: 0,
  })
  processedRecords: number;

  /**
   * Number of records that failed.
   */
  @Column({
    default: 0,
  })
  failedRecords: number;

  /**
   * Error if complete job fails.
   */
  @Column({
    type: "text",
    nullable: true,
  })
  errorMessage: string;

  @Column({
    type: "timestamp",
    nullable: true,
  })
  startedAt: Date;

  @Column({
    type: "timestamp",
    nullable: true,
  })
  completedAt: Date;
}