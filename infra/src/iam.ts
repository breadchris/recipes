import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const environment = pulumi.getStack();

export function createLambdaRole(cacheBucketArn: pulumi.Output<string>) {
  const assumeRolePolicy = aws.iam.getPolicyDocument({
    statements: [
      {
        actions: ["sts:AssumeRole"],
        principals: [
          {
            type: "Service",
            identifiers: ["lambda.amazonaws.com"],
          },
        ],
      },
    ],
  });

  const role = new aws.iam.Role("lambda-role", {
    name: `youtube-extractor-lambda-${environment}`,
    assumeRolePolicy: assumeRolePolicy.then((doc) => doc.json),
  });

  // CloudWatch Logs policy
  new aws.iam.RolePolicy("logs-policy", {
    role: role.id,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          Resource: "arn:aws:logs:*:*:*",
        },
      ],
    }),
  });

  // S3 access policy
  new aws.iam.RolePolicy("s3-policy", {
    role: role.id,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:ListBucket"
          ],
          "Resource": [
            "${cacheBucketArn}",
            "${cacheBucketArn}/*"
          ]
        }
      ]
    }`,
  });

  return role;
}
