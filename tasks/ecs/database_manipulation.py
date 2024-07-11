""" 
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

"""

import logging
import boto3
from botocore.exceptions import ClientError

rds_client = boto3.client('rds')


def retrieve_tcp_port(instance_identifier):
    try:
        response = rds_client.describe_db_cluster_endpoints(DBClusterIdentifier=instance_identifier)
        logging.info("Instance [{}] found.\n".format(response['DBClusterEndpoints'][0]['DBClusterIdentifier']))
        tcp_port = rds_client.describe_db_clusters(DBClusterIdentifier=response['DBClusterEndpoints'][0]['DBClusterIdentifier'])
        return tcp_port['DBClusters'][0]['Port']
    except ClientError as e:
        if(e.response['Error']['Code'] == "DBClusterNotFoundFault"):
            response = rds_client.describe_db_instances(DBInstanceIdentifier=instance_identifier)
            if(response):
                logging.info("Instance [{}] found.\n".format(response['DBInstances'][0]['Endpoint']))
                tcp_port = response['DBInstances'][0]['Endpoint']['Port']
                return tcp_port
        else:
            logging.info(e)

