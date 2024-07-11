""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""
import subprocess
import logging
from subprocess import PIPE



def run_mysqldump_process(db_host, db_name, tcp_port, db_user, db_password, backup_file, s3_bucket):
    try:
        logging.info("Building mysqldump command for [{}] at [{}]\n".format(db_name, db_host))
        command = "mysqldump -h %s -u %s -P %s --quick --no-tablespaces -p%s %s | gzip -c | aws s3 cp - s3://%s/%s --storage-class STANDARD_IA" % (
            db_host, db_user, tcp_port, db_password, db_name,s3_bucket, backup_file)
        proc = subprocess.Popen(command, shell=True, stderr=PIPE, stdout=PIPE)
        logging.debug(command)
        return proc
    except Exception as e:
        logging.exception(e)
