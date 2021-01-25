import { $TSContext } from 'amplify-cli-core';
import { ServiceName } from '../..';
import { category } from '../../constants';
import { ResourceMeta } from '../../provider-utils/awscloudformation/types/packaging-types';
import { buildFunction } from '../../provider-utils/awscloudformation/utils/buildFunction';
import { packageResource } from '../../provider-utils/awscloudformation/utils/package';

export const name = 'build';

/**
 * To maintain existing behavior, this function builds and then packages lambda functions
 */
export const run = async (context: $TSContext) => {
  const resourceName = context?.input?.subCommands?.[0];
  const cont =
    !!resourceName ||
    context.input?.options?.yes ||
    (await context.amplify.confirmPrompt(
      'This will build all functions and layers in your project. Are you sure you want to continue?',
      false,
    ));
  if (!cont) {
    return;
  }
  try {
    const resourcesToBuild = (await getSelectedResources(context, resourceName))
      .filter(resource => resource.build)
      .filter(resource => resource.service === ServiceName.LambdaFunction);
    for await (const resource of resourcesToBuild) {
      resource.lastBuildTimeStamp = await buildFunction(context, resource);
      await packageResource(context, resource);
    }
  } catch (err) {
    context.print.info(err.stack);
    context.print.error('There was an error building the function resources');
    context.usageData.emitError(err);
    process.exitCode = 1;
  }
};

const getSelectedResources = async (context: $TSContext, resourceName?: string) => {
  return (await context.amplify.getResourceStatus(category, resourceName)).allResources as ResourceMeta[];
};
