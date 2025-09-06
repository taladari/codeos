#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from 'codeos-core';
import { initProject, runWorkflow, createBlueprint, setLogLevel, logger } from '../index.js';

const program = new Command();
program
  .name('codeos')
  .description('CodeOS CLI')
  .version('0.1.0')
  .option('-q, --quiet', 'Minimal output', false)
  .option('-v, --verbose', 'Verbose output', false)
  .hook('preAction', (thisCmd) => {
    const opts = thisCmd.opts();
    if (opts.quiet) setLogLevel('quiet');
    else if (opts.verbose) setLogLevel('verbose');
  });

program.command('init').description('Initialize CodeOS in the current repo').action(async () => {
  await initProject();
  logger.info('✅ Initialized .codeos folder');
});

program.command('blueprint').description('Create a new blueprint')
  .argument('<title...>', 'Title for the blueprint')
  .action(async (title) => {
    const t = Array.isArray(title) ? title.join(' ') : String(title);
    const path = await createBlueprint(t);
    logger.info(`📝 Blueprint created at ${path}`);
  });

program.command('run').description('Run a workflow')
  .argument('<name>', 'Workflow name, e.g., build')
  .action(async (name) => {
    const cfg = await loadConfig();
    await runWorkflow(name, cfg);
  });

program.parseAsync(process.argv);
