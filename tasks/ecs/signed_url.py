""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""
import logging
import boto3
from botocore.exceptions import ClientError


s3_client = boto3.client('s3')


def generate_backup_download_url(s3_bucket, object_name, expiration_time_in_minutes,aws_account_id):
    try:
        logging.info("Trying to generate signed url for [{}]\n".format(object_name))
        signed_url_expire_seconds = 60 * int(expiration_time_in_minutes) 
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': s3_bucket,
                                                            'Key': object_name,'ExpectedBucketOwner':aws_account_id},
                                                    ExpiresIn=signed_url_expire_seconds)
        logging.info("Signed url generated for [{}]\n".format(object_name))
        return response
    except ClientError as e:
        logging.exception(e)
        return None
