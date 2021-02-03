import { pathManager, stateManager } from 'amplify-cli-core';
import { SharedIniFileCredentials } from 'aws-sdk';
import _ = require('lodash');
import { ProcessedLambdaFunction } from '../../CFNParser/stack/types';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Appends default labmda environment variables to the environment property of the processedLambda
 * (see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime)
 * Some values are stubbed properly and others have static default values
 */
export const populateLambdaMockEnvVars = (processedLambda: ProcessedLambdaFunction) => {
  processedLambda.environment = [getAwsCredentials, getStaticDefaults, getDynamicDefaults, getDotEnvValues]
    .map(envVarGetter => envVarGetter(processedLambda))
    .reduce((acc, it) => ({ ...acc, ...it }), processedLambda.environment);
};

const getAwsCredentials = (): Record<string, string> => {
  const env = stateManager.getLocalEnvInfo().envName;
  const profile = _.get(stateManager.getLocalAWSInfo(), [env, 'profileName']);
  if (!profile) {
    return {};
  }
  const credentials = new SharedIniFileCredentials({ profile });
  return {
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    AWS_SESSION_TOKEN: credentials.sessionToken,
  };
};

const getStaticDefaults = (): Record<string, string> => ({
  _X_AMZN_TRACE_ID: 'amplify-mock-x-amzn-trace-id',
  AWS_EXECUTION_ENV: 'AWS_Lambda_amplify-mock', // we could do some work to resolve the actual runtime here, but there doesn't seem to be a need at this point
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: '128', // the default
  AWS_LAMBDA_FUNCTION_VERSION: '1',
  AWS_LAMBDA_INITIALIZATION_TYPE: 'on-demand',
  AWS_LAMBDA_LOG_GROUP_NAME: 'amplify-mock-aws-lambda-log-group-name',
  AWS_LAMBDA_LOG_GROUP_STREAM_NAME: 'amplify-mock-aws-lambda-log-group-stream-name',
  TZ: 'UTC',
});

const getDynamicDefaults = (processedLambda: ProcessedLambdaFunction): Record<string, string> => {
  const env = stateManager.getLocalEnvInfo().envName;
  const teamProvider = stateManager.getTeamProviderInfo();
  const region = _.get(teamProvider, [env, 'awscloudformation', 'Region']);
  // This isn't exactly in parity with what the path will be when deployed but we don't have a good mechanism for getting a better value
  const lambdaPath = path.join(pathManager.getBackendDirPath(), 'function', processedLambda.name);

  return {
    _HANDLER: processedLambda.handler,
    AWS_REGION: region,
    AWS_LAMBDA_FUNCTION_NAME: processedLambda.name,
    LAMBDA_TASK_ROOT: lambdaPath,
    LAMBDA_RUNTIME_DIR: lambdaPath,
  };
};

const getDotEnvValues = (processedLambda: ProcessedLambdaFunction): Record<string, string> => {
  try {
    const result = dotenv.config({ path: path.join(pathManager.getBackendDirPath(), 'function', processedLambda.name, '.env') });
    if (result.error) {
      throw result.error;
    }
    return result.parsed;
  } catch {
    // if there's no .env file, carry on without it
  }
};
