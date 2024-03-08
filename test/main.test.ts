import { App, Testing } from "cdktn";
import { beforeAll, describe, expect, it } from "vitest";
import { MyStack } from "../src/stacks/my-stack.js";

describe("MyStack", () => {
  let synthesized: string;
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Terraform interpolation, not a JS template literal
  const schedulerSaRef = "${google_service_account.SchedulerServiceAccount.email}";

  beforeAll(() => {
    // The stack reads these at construction time and throws without them.
    process.env.GCP_PROJECT_ID = "test-project";
    process.env.GCP_REGION = "europe-west1";
    // `runValidations` makes synth fail on construct-level validation errors.
    synthesized = Testing.synth(new MyStack(new App(), "test"), true);
  });

  it("configures the Google provider and enables Cloud Scheduler", () => {
    expect(Testing.toHaveProvider(synthesized, "google")).toBe(true);
    expect(
      Testing.toHaveResourceWithProperties(synthesized, "google_project_service", {
        service: "cloudscheduler.googleapis.com",
        disable_on_destroy: false,
      }),
    ).toBe(true);
  });

  it("uploads the zipped function source and builds from it", () => {
    const object =
      JSON.parse(synthesized).resource.google_storage_bucket_object.CronFunctionSourceObject;
    const fn = JSON.parse(synthesized).resource.google_cloudfunctions_function.CronFunction;

    expect(object.name).toBe("function-source.zip");
    expect(object.source).toMatch(/^assets\/CronFunctionAsset\/.+\.zip$/);
    expect(fn.runtime).toBe("nodejs22");
    expect(fn.entry_point).toBe("handler");
    expect(fn.region).toBe("europe-west1");
    expect(fn.https_trigger_security_level).toBe("SECURE_ALWAYS");
  });

  it("runs the function and the scheduler as two separate service accounts", () => {
    const accounts = JSON.parse(synthesized).resource.google_service_account;

    expect(accounts.CronFunctionServiceAccount.account_id).toMatch(
      /^cron-function-[0-9a-f]{8}-sa$/,
    );
    expect(accounts.SchedulerServiceAccount.account_id).toMatch(/^scheduler-[0-9a-f]{8}-sa$/);
  });

  it("grants only the scheduler account permission to invoke the function", () => {
    expect(
      Testing.toHaveResourceWithProperties(
        synthesized,
        "google_cloudfunctions_function_iam_member",
        {
          role: "roles/cloudfunctions.invoker",
          member: `serviceAccount:${schedulerSaRef}`,
        },
      ),
    ).toBe(true);
  });

  it("schedules a signed GET every minute", () => {
    const job = JSON.parse(synthesized).resource.google_cloud_scheduler_job.Scheduler;

    expect(job.schedule).toBe("* * * * *");
    expect(job.time_zone).toBe("Etc/UTC");
    expect(job.attempt_deadline).toBe("300s");
    expect(job.http_target.http_method).toBe("GET");
    expect(job.http_target.oidc_token.service_account_email).toBe(schedulerSaRef);
  });
});
