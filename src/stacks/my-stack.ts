import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetType, TerraformAsset, TerraformStack } from "cdktn";
import type { Construct } from "constructs";
import { CloudSchedulerJob } from "../../.gen/providers/google/cloud-scheduler-job/index.js";
import { CloudfunctionsFunction } from "../../.gen/providers/google/cloudfunctions-function/index.js";
import { CloudfunctionsFunctionIamMember } from "../../.gen/providers/google/cloudfunctions-function-iam-member/index.js";
import { ProjectService } from "../../.gen/providers/google/project-service/index.js";
import { GoogleProvider } from "../../.gen/providers/google/provider/index.js";
import { ServiceAccount } from "../../.gen/providers/google/service-account/index.js";
import { StorageBucket } from "../../.gen/providers/google/storage-bucket/index.js";
import { StorageBucketObject } from "../../.gen/providers/google/storage-bucket-object/index.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const uniqueId = this.node.addr.substring(0, 8);

    // Read GCP_PROJECT_ID and GCP_REGION from environment variables
    const gcpProjectId = process.env.GCP_PROJECT_ID;
    const gcpRegion = process.env.GCP_REGION;
    if (!gcpProjectId || !gcpRegion) {
      throw new Error(
        "Required environment variables 'GCP_PROJECT_ID' or 'GCP_REGION' are missing or undefined",
      );
    }

    new GoogleProvider(this, "GcpProvider", {
      project: gcpProjectId,
      region: gcpRegion,
    });

    const cloudSchedulerApi = new ProjectService(this, "CloudSchedulerAPI", {
      service: "cloudscheduler.googleapis.com",
      disableOnDestroy: false,
    });

    // Convert path's AssetType from DIRECTORY to ARCHIVE
    const cronFunctionAsset = new TerraformAsset(this, "CronFunctionAsset", {
      path: join(projectRoot, "src", "functions", "cron"),
      type: AssetType.ARCHIVE,
    });

    const cronFunctionSourceBucket = new StorageBucket(this, "CronFunctionSourceBucket", {
      name: `cron-function-source-bucket-${uniqueId}`,
      location: gcpRegion,
    });

    const cronFunctionSourceObject = new StorageBucketObject(this, "CronFunctionSourceObject", {
      name: "function-source.zip",
      bucket: cronFunctionSourceBucket.name,
      source: cronFunctionAsset.path,
    });

    const cronFunctionServiceAccount = new ServiceAccount(this, "CronFunctionServiceAccount", {
      accountId: `cron-function-${uniqueId}-sa`,
      displayName: `Service Account for cron-function-${uniqueId}`,
    });

    const cronFunction = new CloudfunctionsFunction(this, "CronFunction", {
      name: `cron-function-${uniqueId}`,
      region: gcpRegion,
      // 1st gen tops out at nodejs22; nodejs24 is 2nd gen only
      runtime: "nodejs22",
      sourceArchiveBucket: cronFunctionSourceBucket.name,
      sourceArchiveObject: cronFunctionSourceObject.name,
      entryPoint: "handler",
      triggerHttp: true,
      httpsTriggerSecurityLevel: "SECURE_ALWAYS",
      serviceAccountEmail: cronFunctionServiceAccount.email,
    });

    const schedulerServiceAccount = new ServiceAccount(this, "SchedulerServiceAccount", {
      accountId: `scheduler-${uniqueId}-sa`,
      displayName: `Service Account for scheduler-${uniqueId}`,
    });

    new CloudfunctionsFunctionIamMember(this, "CronFunctionInvoker", {
      project: cronFunction.project,
      region: cronFunction.region,
      cloudFunction: cronFunction.name,
      role: "roles/cloudfunctions.invoker",
      member: `serviceAccount:${schedulerServiceAccount.email}`,
    });

    new CloudSchedulerJob(this, "Scheduler", {
      name: `scheduler-${uniqueId}`,
      description: `Trigger ${cronFunction.name} every minute`,
      schedule: "* * * * *",
      timeZone: "Etc/UTC",
      attemptDeadline: "300s",
      httpTarget: {
        httpMethod: "GET",
        uri: cronFunction.httpsTriggerUrl,
        oidcToken: { serviceAccountEmail: schedulerServiceAccount.email },
      },
      dependsOn: [cloudSchedulerApi],
    });
  }
}
