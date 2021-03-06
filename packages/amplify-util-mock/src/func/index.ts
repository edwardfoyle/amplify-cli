import { getInvoker, category, isMockable, getBuilder } from 'amplify-category-function';
import * as path from 'path';
import * as inquirer from 'inquirer';
import { $TSContext, JSONUtilities, pathManager, stateManager } from 'amplify-cli-core';
import _ from 'lodash';
import { BuildType } from 'amplify-function-plugin-interface';
import { loadLambdaConfig } from '../utils/lambda/load-lambda-config';

const DEFAULT_TIMEOUT_SECONDS = 10;

export async function start(context: $TSContext) {
  const ampMeta = stateManager.getMeta();
  let resourceName = context?.input?.subCommands?.[0];
  if (!resourceName) {
    const choices = _.keys(_.get(ampMeta, ['function'])).filter(resourceName => isMockable(context, resourceName).isMockable);
    if (choices.length < 1) {
      throw new Error('There are no mockable functions in the project. Use `amplify add function` to create one.');
    } else if (choices.length == 1) {
      resourceName = choices[0];
    } else {
      const resourceNameQuestion = [
        {
          type: 'list',
          name: 'resourceName',
          message: 'Select the function to mock',
          choices,
        },
      ];
      ({ resourceName } = await inquirer.prompt<{ resourceName: string }>(resourceNameQuestion));
    }
  } else {
    const mockable = isMockable(context, resourceName);
    if (!mockable.isMockable) {
      throw new Error(`Unable to mock ${resourceName}. ${mockable.reason}`);
    }
  }

  const event = await resolveEvent(context, resourceName);
  const lambdaConfig = await loadLambdaConfig(context, resourceName);
  if (!lambdaConfig?.handler) {
    throw new Error(`Could not parse handler for ${resourceName} from cloudformation file`);
  }
  context.print.blue('Ensuring latest function changes are built...');
  await getBuilder(context, resourceName, BuildType.DEV)();
  const invoker = await getInvoker(context, { resourceName, handler: lambdaConfig.handler, envVars: lambdaConfig.environment });
  context.print.blue('Starting execution...');
  await timeConstrainedInvoker(invoker({ event }), context.input.options)
    .then(result => {
      const msg = typeof result === 'object' ? JSON.stringify(result) : result;
      context.print.success('Result:');
      context.print.info(typeof result === 'undefined' ? '' : msg);
    })
    .catch(error => {
      context.print.error(`${resourceName} failed with the following error:`);
      context.print.info(error);
    })
    .then(() => context.print.success('Finished execution.'));
}

interface InvokerOptions {
  timeout?: string;
}
export const timeConstrainedInvoker: <T>(p: Promise<T>, opts: InvokerOptions) => Promise<T> = (promise, options): Promise<any> =>
  Promise.race([promise, getTimer(options)]);

const getTimer = (options: { timeout?: string }) => {
  const inputTimeout = Number.parseInt(options?.timeout, 10);
  const lambdaTimeoutSeconds = !!inputTimeout && inputTimeout > 0 ? inputTimeout : DEFAULT_TIMEOUT_SECONDS;
  const timeoutErrorMessage = `Lambda execution timed out after ${lambdaTimeoutSeconds} seconds. Press ctrl + C to exit the process.
    To increase the lambda timeout use the --timeout parameter to set a value in seconds.
    Note that the maximum Lambda execution time is 15 minutes:
    https://aws.amazon.com/about-aws/whats-new/2018/10/aws-lambda-supports-functions-that-can-run-up-to-15-minutes/\n`;
  return new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutErrorMessage)), lambdaTimeoutSeconds * 1000));
};

const resolveEvent = async (context: $TSContext, resourceName: string): Promise<unknown> => {
  const { amplify } = context;
  const resourcePath = path.join(pathManager.getBackendDirPath(), category, resourceName);
  const eventNameValidator = amplify.inputValidation({
    operator: 'regex',
    value: '^[a-zA-Z0-9/._-]+?\\.json$',
    onErrorMsg: 'Provide a valid unix-like path to a .json file',
    required: true,
  });
  let eventName: string = context.input.options ? context.input.options.event : undefined;
  let promptForEvent = true;
  if (eventName) {
    const validatorOutput = eventNameValidator(eventName);
    const isValid = typeof validatorOutput !== 'string';
    if (!isValid) {
      context.print.warning(validatorOutput);
    } else {
      promptForEvent = false;
    }
  }

  if (promptForEvent) {
    const eventNameQuestion = [
      {
        type: 'input',
        name: 'eventName',
        message: `Provide the path to the event JSON object relative to ${resourcePath}`,
        validate: eventNameValidator,
        default: 'src/event.json',
      },
    ];
    const resourceAnswers = await inquirer.prompt(eventNameQuestion);
    eventName = resourceAnswers.eventName as string;
  }

  return JSONUtilities.readJson(path.resolve(path.join(resourcePath, eventName)));
};

interface InvokerOptions {
  timeout?: string;
}
