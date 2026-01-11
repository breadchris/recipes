import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const environment = pulumi.getStack();
const cacheTtlDays = config.getNumber("cacheTtlDays") || 90;

export const cacheBucket = new aws.s3.Bucket("youtube-cache-bucket", {
  bucket: `recipes-youtube-cache-${environment}`,
  acl: "private",
  versioning: {
    enabled: false,
  },
  lifecycleRules: [
    {
      id: "expire-old-cache",
      enabled: true,
      prefix: "",
      expiration: {
        days: cacheTtlDays,
      },
    },
  ],
  serverSideEncryptionConfiguration: {
    rule: {
      applyServerSideEncryptionByDefault: {
        sseAlgorithm: "AES256",
      },
    },
  },
  tags: {
    Environment: environment,
    Project: "recipes",
    Purpose: "youtube-cache",
  },
});

export const bucketName = cacheBucket.bucket;
export const bucketArn = cacheBucket.arn;
