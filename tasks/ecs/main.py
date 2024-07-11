""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""

import sys
import boto3
import os
import time
import logging
from datetime import datetime

from database_manipulation import retrieve_tcp_port
from backup_process import run_mysqldump_process
from user_notification import publish_sns_message
from signed_url import generate_backup_download_url
from secrets import get_secret

logging.basicConfig(format='%(asctime)s %(message)s',level=logging.INFO)

account_id = boto3.client("sts").get_caller_identity()["Account"]

S3_BUCKET = os.environ['S3_BUCKET']
ZIP_FORMAT = "gz"
SECRET_NAME_SCHEMA = "backup/{}/user"
BACKUP_EXPIRATION_MINUTES = "60"
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']
DB_NAME = os.environ["DB_NAME"]
HOST_NAME = os.environ["HOST_NAME"]
aws_region = os.environ["AWS_REGION"]


def main():
    start_time = datetime.now()
    logging.info("Starting backup process")
    try:
        hostname = HOST_NAME
        split_host = hostname.split(".")
        instance_identifier = split_host[0]
        timestamp = time.strftime('%Y%m%d-%Ih%M')

        secret_name_schema_split_object = SECRET_NAME_SCHEMA.split("{}")

        source_credentials_name = "{}{}{}".format(secret_name_schema_split_object[0], instance_identifier,
                                                  secret_name_schema_split_object[1])

        logging.info("Invoking function [get_secret] for [{}]\n".format(source_credentials_name))
        
        rds_cred_response = get_secret(source_credentials_name)
        db_user = rds_cred_response['username']
        db_pwd = rds_cred_response['password']

        logging.info(f"Invoking function [retrieve_tcp_port] for [{instance_identifier}]")
        tcp_port = retrieve_tcp_port(instance_identifier) # expecting only identifier, not full endpoint address

        logging.info("Invoking function [run_mysqldump_process]\n")
        backup_filename = instance_identifier.replace("-","_") + "_" + DB_NAME + "_" + timestamp + "." + ZIP_FORMAT
        process = run_mysqldump_process(hostname, DB_NAME, tcp_port, db_user, db_pwd, backup_filename, S3_BUCKET)

        output, errors = process.communicate()

        if process.returncode or errors:
            logging.info("mysqldump failed to run\n")
            print(errors)
            process.kill()
        else:
            logging.info("mysqldump has completed successfully!\n")

            logging.info("Invoking generate_backup_download_url\n")
            download_url = generate_backup_download_url(S3_BUCKET, backup_filename, BACKUP_EXPIRATION_MINUTES,account_id)

            if download_url:
                response = publish_sns_message(download_url, DB_NAME, hostname, S3_BUCKET, backup_filename,
                                               BACKUP_EXPIRATION_MINUTES, SNS_TOPIC_ARN)

                logging.info(response)
                end_time = datetime.now()
                delta = end_time - start_time
                logging.info(f"Total time spent: {round(delta.total_seconds())} second(s)")
            return response

    except Exception as e:
        logging.exception(e)


# Using the special variable
# __name__
if __name__ == "__main__":
    main()
