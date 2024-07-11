// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { aws_ec2 as ec2, aws_iam as iam, aws_logs as logs } from "aws-cdk-lib";
import { Subnet } from "aws-cdk-lib/aws-ec2";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface VpcConfiguration extends cdk.NestedStackProps {
    vpcCidr: string | undefined;
    existingVpcId: string | undefined;
}

export class VpcStack extends cdk.NestedStack {
    public readonly vpc: ec2.IVpc;
    public readonly defaultSg: ec2.ISecurityGroup;
    public readonly vpcFlowLog: ec2.FlowLog;
    public readonly apiGwEndpoint: ec2.InterfaceVpcEndpoint;
    public readonly privateSubnets: ec2.IPrivateSubnet[];
    constructor(scope: Construct, id: string, props: VpcConfiguration) {
        super(scope, id, props);

        NagSuppressions.addStackSuppressions(this, [
            { id: 'CdkNagValidationFailure', reason: 'Remove vlaidation warnings for interface endpoints not supported by Nag.' },
        ]);

        const vpcName = id;
        if (props.existingVpcId) {
            this.vpc = ec2.Vpc.fromLookup(this, vpcName, {
                vpcId: props.existingVpcId
            });
        } else {
            this.vpc = new ec2.Vpc(this, vpcName, {
                ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr ?? "10.192.0.0/16"),
                enableDnsSupport: true,
                enableDnsHostnames: true,
                maxAzs: 2,
                vpcName,
                subnetConfiguration: [
                    {
                        subnetType: ec2.SubnetType.PUBLIC,
                        name: "Public",
                        cidrMask: 24,
                        mapPublicIpOnLaunch: false,
                    },
                    {
                        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                        name: "Private",
                        cidrMask: 24,
                    },
                ],
            });
        }

        this.privateSubnets = this.vpc.privateSubnets;

        const vpcLogGroup = new logs.LogGroup(this, `${vpcName}-flow-logs-group`, {
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const vpcRole = new iam.Role(this, `${vpcName}-flow-logs-role`, {
            assumedBy: new iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
        });

        this.vpcFlowLog = new ec2.FlowLog(this, `${vpcName}-flow-log`, {
            resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
            destination: ec2.FlowLogDestination.toCloudWatchLogs(vpcLogGroup, vpcRole),
        });

        this.vpc.addInterfaceEndpoint('secretsMangerEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });

        this.vpc.addInterfaceEndpoint("EcrEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.ECR,
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });

        this.vpc.addInterfaceEndpoint("EcrDockerEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });

        this.apiGwEndpoint = this.vpc.addInterfaceEndpoint("APIGatewayEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });

        this.vpc.addGatewayEndpoint("s3-endpoint", {
            service: ec2.GatewayVpcEndpointAwsService.S3,
        });
    }
}