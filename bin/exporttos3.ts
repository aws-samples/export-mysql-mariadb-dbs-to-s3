// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Aspects, Tags } from "aws-cdk-lib";
import { ExportStack } from '../lib/export-stack';
import { AwsSolutionsChecks } from "cdk-nag";

const vpcCidr = process.env.VPC_CIDR ?? undefined;
const existingVpcId = process.env.EXISTING_VPC_ID ?? undefined;

const appName = "exportMysqlToS3"
const app = new cdk.App();

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const exportStack = new ExportStack(app, appName, {
    vpcCidr,
    existingVpcId,
    env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
    },
});
Tags.of(exportStack).add("Stack", "ExportMysqlToS3");
