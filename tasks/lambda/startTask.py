""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""

import os
import json
import logging
import boto3
import time

logger = logging.getLogger()
logging.basicConfig(format='%(process)d-%(levelname)s-%(message)s')
logger.setLevel(logging.INFO)


REGION = os.environ['REGION']
ECS_CLUSTER = os.environ['ECS_CLUSTER']
ECS_TASK_DEFINITION = os.environ['ECS_TASK_DEFINITION']
CONTAINER_NAME = os.environ['ECS_TASK_CONTAINER_NAME']
SECURITY_GROUP_ID = os.environ['SECURITY_GROUP_ID']
SUBNETS = os.environ['ECS_SUBNETS'].split(',')

ecs_client = boto3.client('ecs', region_name=REGION)

def lambda_handler(event, context):
    logger.info('request: {}'.format(json.dumps(event)))

    query_string_params = event["queryStringParameters"] or {}
    host_name = query_string_params.get("hostname") or ""
    db_name = query_string_params.get("dbName") or ""

    response = ecs_client.run_task(
        cluster=ECS_CLUSTER,
        launchType='FARGATE',
        taskDefinition=ECS_TASK_DEFINITION,
        count=1,
        platformVersion='LATEST',
        networkConfiguration={
        'awsvpcConfiguration': {
            'subnets': SUBNETS,
            'assignPublicIp': 'DISABLED',
            'securityGroups': [
                SECURITY_GROUP_ID,
            ],
        }
    },
        overrides={
            "containerOverrides": [
                {
                    "name": CONTAINER_NAME,
                    "environment": [
                        {"name": 'DB_NAME', "value": db_name},
                        {"name": 'HOST_NAME', "value": host_name}
                    ]
                }
            ],
        },
    )

    logger.info('Container start response: {}'.format(str(response)))

    time.sleep(5)
    task_arn = response['tasks'][0]['taskArn']
    parameters = response['tasks'][0]['overrides']['containerOverrides'][0]['environment']
    parameters_info = ', '.join([f"{param['name']}={param['value']}" for param in parameters])
    path = event['path']
    output = f"Container request started for {path}. ECS Task is: {task_arn} with the following parameters: {parameters_info}"

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'text/plain'
        },
        'body': output
        
    }