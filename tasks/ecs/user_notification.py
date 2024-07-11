""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""
import boto3
import logging

sns_client = boto3.client('sns')


def publish_sns_message(url, database_name, instance_identifier, s3_bucket, object_name, backup_expiration_minutes,
                        sns_topic_arn):
    try:
        logging.info("Publishing SNS message for [{}]\n".format(database_name))
        subject = "Your backup request for [{0}] has completed!".format(database_name)
        msg = "The URL will be valid for {6} minutes\nInstance Identifier: {0}\nDatabase Name: {1}\nS3 Bucket: {2}\nObject Name: {3}\nDownload URL: {4} \n\nIf the link does not work for you, please copy this link into your browser without the [].\n[{5}]".format(
            instance_identifier, database_name, s3_bucket, object_name, url, url, backup_expiration_minutes)
        response = sns_client.publish(
            TopicArn=sns_topic_arn,
            Message=msg,
            Subject=subject)

        return response

    except Exception as e:
        logging.exception(e)