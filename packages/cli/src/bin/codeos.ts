#!/usr/bin/env node
import { Command } from 'commander';
import { config as dotenvConfig } from 'dotenv'
import path from 'node:path'
import { loadConfig, analyzeRepo, writeAnalyzeReport } from 'codeos-core';
import { initProject, runWorkflow, createBlueprint, setLogLevel, logger, findProjectRoot, selectProvider, resumeWorkflow, listWorkflowRuns, retryWorkflowFromStep, inspectWorkflowRun } from '../index.js';

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
    const root = await findProjectRoot();
    dotenvConfig({ path: path.join(root, '.env') })
    const cfg = await loadConfig(root);
    const provider = await selectProvider(cfg)
    await runWorkflow(name, cfg, root, provider);
  });

program.command('analyze').description('Detect repo stack and write .codeos/reports/analyze.json')
  .action(async () => {
    const root = await findProjectRoot();
    const report = await analyzeRepo(root);
    const out = await writeAnalyzeReport(root, report);
    logger.info(`🧭 Analyzer wrote ${out}`)
  })

program.command('resume').description('Resume a failed workflow run')
  .argument('<runId>', 'Run ID to resume')
  .action(async (runId) => {
    const root = await findProjectRoot();
    dotenvConfig({ path: path.join(root, '.env') })
    const cfg = await loadConfig(root);
    const provider = await selectProvider(cfg)
    await resumeWorkflow(runId, root, provider);
  });

program.command('runs').description('List workflow runs')
  .action(async () => {
    const root = await findProjectRoot();
    await listWorkflowRuns(root);
  });

program.command('retry').description('Retry workflow from a specific step')
  .argument('<runId>', 'Run ID to retry')
  .argument('<stepIndex>', 'Step index to retry from (0-based)', (val) => parseInt(val, 10))
  .action(async (runId, stepIndex) => {
    const root = await findProjectRoot();
    dotenvConfig({ path: path.join(root, '.env') })
    const cfg = await loadConfig(root);
    const provider = await selectProvider(cfg)
    await retryWorkflowFromStep(runId, stepIndex, root, provider);
  });

program.command('inspect').description('Inspect workflow run details')
  .argument('<runId>', 'Run ID to inspect')
  .action(async (runId) => {
    const root = await findProjectRoot();
    await inspectWorkflowRun(runId, root);
  });

program.parseAsync(process.argv);
