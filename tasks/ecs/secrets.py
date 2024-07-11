""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""
import os
import boto3
import json
from botocore.exceptions import ClientError
import base64
import logging


aws_region = os.environ["AWS_REGION"]
secrets_manager_client = boto3.client(service_name='secretsmanager', region_name=aws_region)


def get_secret(secret_name):
    try:
        logging.info(f'Getting secret {secret_name}')
        get_secret_value_response = secrets_manager_client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        logging.exception(f'{e.response["Error"]["Code"]}: {e.response["Error"]["Message"]}')

    # Decrypts secret using the associated KMS key.
    # Depending on whether the secret is a string or binary, one of these fields will be populated.
    if 'SecretString' in get_secret_value_response:
        secret = get_secret_value_response['SecretString']
        return json.loads(secret)
    else:
        return base64.b64decode(get_secret_value_response['SecretBinary'])