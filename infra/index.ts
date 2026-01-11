import * as pulumi from "@pulumi/pulumi";

import { cacheBucket, bucketName, bucketArn } from "./src/s3";
import { createLambdaRole } from "./src/iam";
import {
  createLambdaFunction,
  createEcrRepository,
  buildAndPushImage,
} from "./src/lambda";
import { createApiGateway } from "./src/api-gateway";

// Create ECR repository for Lambda container
const repo = createEcrRepository();

// Build and push Docker image
const image = buildAndPushImage(repo);

// Create IAM role
const lambdaRole = createLambdaRole(bucketArn);

// Create Lambda function
const extractorFunction = createLambdaFunction(
  lambdaRole,
  bucketName,
  image.imageUri
);

// Create API Gateway
const { endpoint } = createApiGateway(extractorFunction);

// Exports
export const apiEndpoint = endpoint;
export const s3BucketName = bucketName;
export const functionName = extractorFunction.name;
export const repositoryUrl = repo.url;
