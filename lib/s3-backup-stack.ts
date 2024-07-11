// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { aws_s3 as s3, Duration, RemovalPolicy } from "aws-cdk-lib";
import { BlockPublicAccess, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
export interface S3Configuration extends cdk.NestedStackProps {
    bucketName: string,
}

export class S3BackupStack extends cdk.NestedStack {
    public readonly bucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: S3Configuration) {
        super(scope, id, props);
        
        NagSuppressions.addStackSuppressions(this, [
            { id: 'AwsSolutions-S1', reason: 'No access logs needed for this bucket.' },
        ]);

        const bucketName = `${id}-${props.bucketName}`;
        this.bucket = new s3.Bucket(this, bucketName, {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: false,
            removalPolicy: RemovalPolicy.DESTROY,
            lifecycleRules: [{
                expiration: Duration.days(1)
            }],
        });
    }
}