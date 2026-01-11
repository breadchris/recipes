import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const environment = pulumi.getStack();

export function createApiGateway(lambdaFunction: aws.lambda.Function) {
  const api = new aws.apigatewayv2.Api("youtube-extractor-api", {
    name: `youtube-extractor-${environment}`,
    protocolType: "HTTP",
    corsConfiguration: {
      allowOrigins: ["*"],
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 300,
    },
  });

  const integration = new aws.apigatewayv2.Integration("lambda-integration", {
    apiId: api.id,
    integrationType: "AWS_PROXY",
    integrationUri: lambdaFunction.arn,
    payloadFormatVersion: "2.0",
  });

  new aws.apigatewayv2.Route("extract-route", {
    apiId: api.id,
    routeKey: "POST /extract",
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  const stage = new aws.apigatewayv2.Stage("default-stage", {
    apiId: api.id,
    name: "$default",
    autoDeploy: true,
    defaultRouteSettings: {
      throttlingBurstLimit: 10,
      throttlingRateLimit: 5,
    },
  });

  // Allow API Gateway to invoke Lambda
  new aws.lambda.Permission("api-gateway-permission", {
    function: lambdaFunction.name,
    action: "lambda:InvokeFunction",
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });

  return {
    api,
    stage,
    endpoint: pulumi.interpolate`${api.apiEndpoint}/extract`,
  };
}
