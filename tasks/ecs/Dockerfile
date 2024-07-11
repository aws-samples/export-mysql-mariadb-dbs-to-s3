# // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# // SPDX-License-Identifier: MIT-0


FROM python:3.9-slim-buster
WORKDIR /app


RUN apt-get update -y
RUN apt-get install g++ make cmake unzip libcurl4-openssl-dev libpq-dev python-dev -y
RUN apt-get install gcc -y

# Installing AWS CLI to upload to S3 bucket
RUN pip3 install awscli
RUN pip3 install mysql-connector-python boto3

# Installing mysqldump and cleaning apt cache
RUN apt-get update && apt install -y mariadb-client && \
  apt-get clean autoclean && \
  apt-get autoremove --yes && \
  rm -rf /var/lib/{apt,dpkg,cache,log}/

RUN pip install --upgrade pip
COPY ./ ./
RUN pip install --no-cache-dir -r requirements.txt

# gunicorn
CMD ["python3","./main.py"]