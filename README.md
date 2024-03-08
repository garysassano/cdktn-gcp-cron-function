# cdktn-gcp-cron-function

CDKTN app that triggers a Cloud Function at a specified regular interval.

### Related Apps

- [cdk-aws-cron-function](https://github.com/garysassano/cdk-aws-cron-function) - Uses AWS instead of GCP; built with AWS CDK instead of CDKTF.

## Prerequisites

- **_GCP:_**
  - Must have authenticated with [Application Default Credentials](https://registry.terraform.io/providers/hashicorp/google/latest/docs/guides/provider_reference#running-terraform-on-your-workstation) in your local environment.
  - Must have set the `GCP_PROJECT_ID` and `GCP_REGION` variables in your local environment.
- **_mise:_**
  - [Install mise](https://mise.jdx.dev/installing-mise.html), which manages Node, pnpm, and OpenTofu.

## Installation

```sh
mise install
pnpm install
pnpm gen
```

`pnpm gen` generates the Google provider constructs into `.gen/`. Re-run it whenever the provider constraint in `cdktf.json` changes.

`pnpm synth`, `pnpm diff`, and `pnpm deploy` all read `GCP_PROJECT_ID` and `GCP_REGION`; the stack throws without them.

## Deployment

```sh
pnpm deploy
```

## Cleanup

```sh
pnpm destroy
```

## Architecture Diagram

![Architecture Diagram](./src/assets/arch-diagram.svg)
