// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as path from "path";
import { LambdaIntegration, ApiKey, UsagePlanProps, Period } from "aws-cdk-lib/aws-apigateway";
import { ISecurityGroup, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { NagSuppressions } from "cdk-nag";

export interface ApiGatewayConfiguration extends cdk.NestedStackProps {
  vpc: cdk.aws_ec2.IVpc;
  apiGwEndpoint: cdk.aws_ec2.IVpcEndpoint;
  region: string;
  clusterArn: string;
  taskArn: string;
  ecsExecutionRoleArn: string;
  ecsTaskRoleArn: string;
  containerName: string;
  ecsPrivateSubnets: string;
}

export class ApiGatewayStack extends cdk.NestedStack {
  public readonly restApi: apigw.IRestApi;
  public readonly securityGroup: ISecurityGroup;

  constructor(scope: Construct, id: string, props: ApiGatewayConfiguration) {
    super(scope, id, props);

    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-APIG3', reason: 'WAF not needed for private api.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-APIG2', reason: 'Validation not needed for private api.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-COG4', reason: 'Cognito is not in scope for this.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-APIG4', reason: 'No auth in scope for this private api method.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-SMG4', reason: 'Rotation of api key not in scope for this.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-IAM4', reason: 'AWS Managed Policy works for this.' },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard is needed for this.' },
    ]);

    const lambdaRole = new cdk.aws_iam.Role(this, "LambdaRole", {
      roleName: `${id}-lambda-backup-role`,
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaRole.addManagedPolicy(
      cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
    );
    lambdaRole.addManagedPolicy(
      cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
    );

    const ecsRunTaskPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ["ecs:RunTask"],
      conditions: { ArnEquals: { "ecs:cluster": props.clusterArn } },
      resources: [props.taskArn],
    });

    const ecsIamPassPolicy = new cdk.aws_iam.PolicyStatement({
      actions: ["iam:PassRole"],
      resources: [props.ecsExecutionRoleArn, props.ecsTaskRoleArn],
    });

    lambdaRole.addToPolicy(ecsRunTaskPolicy);
    lambdaRole.addToPolicy(ecsIamPassPolicy);

    this.securityGroup = new SecurityGroup(this, "SecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: "Security Group for inbound traffic on RDS"
    });

    const backupLambda = new cdk.aws_lambda.Function(this, 'backupHandler', {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_9,
      vpc: props.vpc,
      code: cdk.aws_lambda.Code.fromAsset(path.join(__dirname, "..", "tasks/lambda/")),
      handler: 'startTask.lambda_handler',
      memorySize: 128,
      role: lambdaRole,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      timeout: cdk.Duration.seconds(20),
      environment: {
        "REGION": props.region,
        "ECS_CLUSTER": props.clusterArn,
        "ECS_TASK_DEFINITION": props.taskArn,
        "ECS_TASK_CONTAINER_NAME": props.containerName,
        "ECS_SUBNETS": props.ecsPrivateSubnets,
        "SECURITY_GROUP_ID": this.securityGroup.securityGroupId,
      }
    });

    const logGroup = new LogGroup(this, "LogGroup", {
      logGroupName: `/aws/apigateway/${id}-api`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigw.LambdaRestApi(this, "exporttos3-rest-api", {
      endpointTypes: [apigw.EndpointType.PRIVATE],
      handler: backupLambda,
      proxy: false,
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apigw.LogGroupLogDestination(logGroup),
        metricsEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      policy: new cdk.aws_iam.PolicyDocument({
        statements: [
          new cdk.aws_iam.PolicyStatement({
            principals: [new cdk.aws_iam.AnyPrincipal],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            effect: cdk.aws_iam.Effect.DENY,
            conditions: {
              StringNotEquals: {
                "aws:SourceVpce": props.apiGwEndpoint.vpcEndpointId
              }
            }
          }),
          new cdk.aws_iam.PolicyStatement({
            principals: [new cdk.aws_iam.AnyPrincipal],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            effect: cdk.aws_iam.Effect.ALLOW
          })
        ]
      })
    });

    const integration = new LambdaIntegration(backupLambda);

    const backupMethod = api.root.addResource("backup");
    backupMethod.addMethod("GET", integration, { apiKeyRequired: true });

    const EXCLUDED_CHARS = "/'";
    const apiKeySecret = new cdk.aws_secretsmanager.Secret(this, 'ApiKeySecretValue', {
      description: "API key for backup creation",
      secretName: "backup/exportToS3/apiKey",
      generateSecretString: {
        excludePunctuation: true,
        excludeCharacters: EXCLUDED_CHARS,
        passwordLength: 20,
      }
    });
    const apiKey = new ApiKey(this, 'backupApiKey', {
      apiKeyName: 'apiKeyForBackup',
      description: 'APIKey used to access the backup API endpoint',
      enabled: true,
      value: apiKeySecret.secretValue.unsafeUnwrap()
    });

    const usagePlanProps: UsagePlanProps = {
      name: 'Backup usage plan',
      apiStages: [{ stage: api.deploymentStage }],
      throttle: { burstLimit: 2, rateLimit: 10 }, quota: { limit: 100, period: Period.DAY }
    }

    const plan = api.addUsagePlan("ExamplePlan", usagePlanProps);
    plan.addApiKey(apiKey);

    this.restApi = api;

  }
}