// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from "constructs";
import { EcsBackupTaskStack } from '../lib/ecs-backup-task-stack';
import { EcsStack } from '../lib/ecs-stack';
import { VpcStack } from '../lib/vpc-stack';
import { ApiGatewayStack } from './api-gateway-stack';
import { S3BackupStack } from './s3-backup-stack';


export interface ExportStackConfiguration extends cdk.StackProps {
    vpcCidr: string | undefined;
    existingVpcId: string | undefined;
}

export class ExportStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: ExportStackConfiguration) {
        super(scope, id, props);


        NagSuppressions.addStackSuppressions(this, [
            { id: 'AwsSolutions-SNS2', reason: 'No SNS encryption needed.' },
        ]);

        const account = cdk.Stack.of(this).account;
        const region = cdk.Stack.of(this).region;

        const ecsTaskCpuUnitsParameter = new cdk.CfnParameter(this, "ECSTaskCPU", {
            type: "String",
            description: "ECS CPU Units to use for the backup task",
            allowedValues: ["256", "512", "1024", "2048", "4096", "8196"],
            default: "2048"
        });

        const ecsTaskMemoryValueParameter = new cdk.CfnParameter(this, 'ECSTaskMemory', {
            type: "String",
            description: "ECS Memory Units to use for the backup task",
            allowedValues: ["512", "1024", "2048", "4096", "8192", "12288", "16384", "32768"],
            default: "8192"
        });

        const emailReceiverParameter = new cdk.CfnParameter(this, "BackupEmailReceivers", {
            type: "String",
            description: "Comma separated list of emails to send the backup result too",
        });
        const emails = emailReceiverParameter.valueAsString.split(",");

        const vpcStack = new VpcStack(this, `${id}-vpc`, {
            vpcCidr: props.vpcCidr,
            existingVpcId: props.existingVpcId,
        });

        const ecsStack = new EcsStack(this, `${id}-ecs`, {
            vpc: vpcStack.vpc,
        });

        const s3Bucket = new S3BackupStack(this, `${id}-s3`, {
            bucketName: "export-bucket",
        });

        const ecsBackupTaskStack = new EcsBackupTaskStack(this, `${id}-task`, {
            ecsTaskCpuUnits: ecsTaskCpuUnitsParameter.valueAsString,
            ecsTaskMemory: ecsTaskMemoryValueParameter.valueAsString,
            logGroup: ecsStack.ecsTasksLogGroup,
            receiverEmail: emails,
            s3Bucket: s3Bucket.bucket,
            awsRegion: region,
            awsAccountId: account,
        });

        const apiGW = new ApiGatewayStack(this, `${id}-api`, {
            vpc: vpcStack.vpc,
            apiGwEndpoint: vpcStack.apiGwEndpoint,
            region,
            clusterArn: ecsStack.ecsCluster.clusterArn,
            taskArn: ecsBackupTaskStack.ecsTaskDefinition.taskDefinitionArn,
            ecsExecutionRoleArn: ecsBackupTaskStack.ecsExecutionRole.roleArn,
            ecsTaskRoleArn: ecsBackupTaskStack.ecsTaskRole.roleArn,
            containerName: ecsBackupTaskStack.containerName,
            ecsPrivateSubnets: vpcStack.privateSubnets.map(item => item.subnetId).join(","),
        });

        new CfnOutput(this, 'apiURL', {
            description: "This is the url where you can ping start a backup request.",
            value: `https://${apiGW.restApi.restApiId}.execute-api.${region}.amazonaws.com/prod/backup`,
        });

        new CfnOutput(this, 'ecsRoleName', {
            description: "This is the role of the task that will try to connect to your DB.",
            value: ecsBackupTaskStack.ecsTaskRole.roleName,
        });

        new CfnOutput(this, 'SecurityGroupId', {
            description: "This is the security group for the backup task, allow a connection from it to the DB in your RDS security group.",
            value: apiGW.securityGroup.securityGroupId,
        });

        new CfnOutput(this, 'S3Bucket', {
            description: "This is the S3 bucket where the backup file(s) will be saved.",
            value: s3Bucket.bucket.bucketName,
        });
    }

}