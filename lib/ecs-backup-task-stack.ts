// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_ecs as ecs, aws_iam as iam, aws_logs as logs, aws_sns as sns, aws_s3 as s3 } from "aws-cdk-lib";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { NagSuppressions } from "cdk-nag";
import * as kms from 'aws-cdk-lib/aws-kms';

export interface EcsBackupTaskConfiguration extends cdk.NestedStackProps {
  ecsTaskCpuUnits: string,
  ecsTaskMemory: string,
  logGroup: logs.ILogGroup,
  receiverEmail: string[],
  s3Bucket: s3.IBucket,
  awsRegion: string,
  awsAccountId: string,
}

export class EcsBackupTaskStack extends cdk.NestedStack {
  public ecsTaskRole: iam.Role;
  public ecsTaskDefinition: ecs.TaskDefinition;
  public ecsExecutionRole: iam.Role;
  public containerName: string;

  constructor(scope: Construct, id: string, props: EcsBackupTaskConfiguration) {
    super(scope, id, props);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-IAM4', reason: 'AWS Managed Policy works for this.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard is needed for this.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-ECS2', reason: 'Secrets not needed for the task definition environment variables.' },
    ]);

    this.ecsExecutionRole = new iam.Role(this, "EcsExecutionRole", {
      roleName: `${id}-execution-role`,
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")],
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    this.ecsTaskRole = new iam.Role(this, "EcsTaskRole", {
      roleName: `${id}-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const secretsManagerPolicy = new cdk.aws_iam.PolicyStatement({
      actions: [
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds",
      ],
      resources: [`arn:aws:secretsmanager:${props.awsRegion}:${props.awsAccountId}:secret:*`],
      effect: cdk.aws_iam.Effect.ALLOW,
    });

    this.ecsTaskRole.addToPolicy(secretsManagerPolicy);


    const rdsManagementPolicy = new cdk.aws_iam.PolicyStatement({
      actions: [
        "rds:DescribeDBClusterEndpoints",
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusters"
      ],
      resources: [
        `arn:aws:rds:${props.awsRegion}:${props.awsAccountId}:db:*`,
        `arn:aws:rds:${props.awsRegion}:${props.awsAccountId}:cluster-endpoint:*`,
        `arn:aws:rds:${props.awsRegion}:${props.awsAccountId}:cluster:*`,
      ],
      effect: cdk.aws_iam.Effect.ALLOW,
    });

    this.ecsTaskRole.addToPolicy(rdsManagementPolicy);

    const kmksKey = new kms.Key(this, 'key', {
      enableKeyRotation: true,
    });

    const snsTopic = new sns.Topic(this, "topic", {
      topicName: `${id}-topic`,
      masterKey: kmksKey,
    });

    const snsPublishPolicy = new cdk.aws_iam.PolicyStatement({
      actions: [
        "sns:Publish"
      ],
      resources: [snsTopic.topicArn],
      effect: cdk.aws_iam.Effect.ALLOW,
    });

    this.ecsTaskRole.addToPolicy(snsPublishPolicy);

    const KMSPermissionPolicy = new cdk.aws_iam.PolicyStatement({
      actions: [
        "kms:GenerateDataKey",
        "kms:Decrypt"
      ],
      resources: ["*"],
      effect: cdk.aws_iam.Effect.ALLOW,
    });

    this.ecsTaskRole.addToPolicy(KMSPermissionPolicy);

    props.s3Bucket.grantReadWrite(this.ecsTaskRole);

    this.ecsTaskDefinition = new ecs.TaskDefinition(this, "task-definition", {
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.FARGATE,
      family: id,
      taskRole: this.ecsTaskRole,
      executionRole: this.ecsExecutionRole,
      cpu: props.ecsTaskCpuUnits,
      memoryMiB: props.ecsTaskMemory,
    });

    props.receiverEmail = props.receiverEmail || [];
    props.receiverEmail.forEach(item => this.addSubscription(item, snsTopic));

    const logPrefix = `${id}_container`;
    this.ecsTaskDefinition.addContainer(`${id}-container`, {
      image: ecs.RepositoryImage.fromAsset("tasks/ecs/"),
      essential: true,
      command: ["python", "./main.py"],
      logging: ecs.LogDriver.awsLogs({
        logGroup: props.logGroup,
        streamPrefix: logPrefix,
        datetimeFormat: "%Y-%m-%d",
      }),
      environment: {
        "SNS_TOPIC_ARN": snsTopic.topicArn,
        "S3_BUCKET": props.s3Bucket.bucketName,
        "AWS_REGION": props.awsRegion,
        "DB_NAME": "undefined",
        "HOST_NAME": "undefined",
      },
    });
    this.containerName = this.ecsTaskDefinition.defaultContainer?.containerName ?? "ERROR";
  }

  private addSubscription(email: string, topic: sns.Topic) {
    try {
      topic.addSubscription(new EmailSubscription(email.trim()));
    } catch (e) {
      console.log("Error adding email to topic.");
    }
  }
}