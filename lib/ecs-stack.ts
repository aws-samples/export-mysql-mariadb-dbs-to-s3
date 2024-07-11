// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import {aws_ec2 as ec2, aws_ecs as ecs, aws_iam as iam, aws_logs as logs} from "aws-cdk-lib";
import { Construct } from "constructs";
export interface EcsConfiguration extends cdk.NestedStackProps {
    vpc: ec2.IVpc,
}

export class EcsStack extends cdk.NestedStack {
    public readonly ecsTasksLogGroup: logs.ILogGroup;
    public readonly ecsCluster: ecs.ICluster;

    constructor(scope: Construct, id: string, props: EcsConfiguration) {
        super(scope, id, props);

        this.ecsCluster = new ecs.Cluster(this, "ECSCluster", {
            clusterName: `${id}-cluster`,
            containerInsights: true,
            vpc: props.vpc,
        });

        this.ecsTasksLogGroup = new logs.LogGroup(this, "ECSLogGroup", {
            logGroupName: `${id}-log-group`,
            retention: cdk.aws_logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
}