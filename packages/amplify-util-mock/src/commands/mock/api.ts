import { start } from '../../api';

export const name = 'api';

export const run = async context => {
  if (context.parameters.options.help) {
    const header = `amplify mock ${name} \nDescription:
    Mock GraphQL API locally`;
    context.amplify.showHelp(header, []);
    return;
  }
  try {
    await start(context);
  } catch (e) {
    context.print.error(e.message);
  }
};
