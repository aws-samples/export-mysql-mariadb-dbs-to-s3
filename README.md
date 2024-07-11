# Export MySQL & MariaDB schema dumps to Amazon S3

This GitHub repository is used by the AWS Blog: ExportMySQL & MariaDB schema dumps to Amazon S3. For guidance on how to use this, check the official blog post.

# Pre-requisites

- An active AWS account with a VPC and at least one of the following database platforms deployed:
  - Amazon Aurora MySQL-Compatible Edition
  - Amazon RDS for MySQL
  - Amazon RDS for MariaDB
- The AWS Command Line Interface (AWS CLI) installed and configured. 
- To setup AWS CDK v2 on your local machine, follow the instructions provided in Getting Started with the AWS CDK.
- The AWS Cloud Development Kit (AWS CDK) v2 set up on the local machine. This project uses TypeScript as the language. Make sure to have that set up on your laptop.
- Docker installed on your laptop to build the container for the first time. 
- The exporttos3 GitHub repository downloaded to your local machine.
  - A template to the above IAM role is provided in this repository.

# Limitations

This solution has the following limitations:
- Database restore is not contemplated by this solution.
- Backing up databases from a cross-region read-replica have not been tested, and is not part of this solution.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

