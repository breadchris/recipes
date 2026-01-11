import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const environment = pulumi.getStack();
const logLevel = config.get("logLevel") || "INFO";
const maxConcurrency = config.getNumber("maxConcurrency") || 5;

// Proxy configuration for YouTube scraping (Oxylabs)
const proxyUrl = config.get("proxyUrl") || "";
const proxyUsername = config.get("proxyUsername") || "";
const proxyPassword = config.getSecret("proxyPassword") || "";

export function createLambdaFunction(
  role: aws.iam.Role,
  bucketName: pulumi.Output<string>,
  imageUri: pulumi.Output<string>
) {
  const extractorFunction = new aws.lambda.Function("youtube-extractor", {
    name: `youtube-extractor-${environment}`,
    packageType: "Image",
    imageUri: imageUri,
    role: role.arn,
    timeout: 300, // 5 minutes
    memorySize: 1024, // 1 GB
    ephemeralStorage: {
      size: 1024, // 1 GB
    },
    environment: {
      variables: {
        S3_BUCKET: bucketName,
        LOG_LEVEL: logLevel,
        PYTHONUNBUFFERED: "1",
        PROXY_URL: proxyUrl,
        PROXY_USERNAME: proxyUsername,
        PROXY_PASSWORD: proxyPassword,
      },
    },
    // Note: reservedConcurrentExecutions removed - AWS account has limited concurrency
  });

  return extractorFunction;
}

export function createEcrRepository() {
  const repo = new awsx.ecr.Repository("youtube-extractor-repo", {
    name: `youtube-extractor-${environment}`,
    forceDelete: true,
  });

  return repo;
}

export function buildAndPushImage(repo: awsx.ecr.Repository) {
  const image = new awsx.ecr.Image("youtube-extractor-image", {
    repositoryUrl: repo.url,
    context: "../lambda/youtube-extractor",
    platform: "linux/amd64",
  });

  return image;
}
