import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";

import { BaseEntity } from "./BaseEntity";
import { Client } from "./Client";
import { TallySyncJob } from "./TallySyncJob";

export enum TallyDeviceStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  ERROR = "ERROR",
}

@Entity("tally_devices")
export class TallyDevice extends BaseEntity {

  @PrimaryGeneratedColumn()
  id: number;

  /**
   * B2B client who owns this Tally connector.
   */
  @Column()
  @Index()
  clientId: number;

  @ManyToOne(
    () => Client,
    (client) => client.tallyDevices,
    {
      onDelete: "CASCADE",
    }
  )
  @JoinColumn({
    name: "clientId",
  })
  client: Client;

  @Column({
    unique: true,
  })
  deviceId: string;

  @Column({
    nullable: true,
  })
  deviceName: string;

  @Column({
    type: "text",
    nullable: true,
    select: false,
  })
  accessToken: string;

  @Column({
    type: "enum",
    enum: TallyDeviceStatus,
    default: TallyDeviceStatus.OFFLINE,
  })
  status: TallyDeviceStatus;

  @Column({
    default: false,
  })
  tallyConnected: boolean;

  @Column({
    nullable: true,
  })
  companyName: string;

  @Column({
    type: "timestamp",
    nullable: true,
  })
  lastSeenAt: Date;

  @OneToMany(
    () => TallySyncJob,
    (job) => job.tallyDevice
  )
  syncJobs: TallySyncJob[];
}