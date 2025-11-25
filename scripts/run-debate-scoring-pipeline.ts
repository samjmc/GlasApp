import 'dotenv/config';
import { spawn } from 'child_process';

const STEPS: Array<{ name: string; command: string[] }> = [
  {
    name: 'Evaluate debate participants',
    command: ['npm', 'run', 'debates:evaluate']
  },
  {
    name: 'Generate debate outcomes',
    command: ['npm', 'run', 'debates:outcomes']
  },
  {
    name: 'Calculate section contributions',
    command: ['npm', 'run', 'debates:section-contributions']
  },
  {
    name: 'Regenerate debate highlights',
    command: ['npm', 'run', 'debates:highlights']
  }
];

async function runCommand(stepName: string, command: string[]): Promise<void> {
  console.log(`\n▶️  ${stepName}`);
  console.log(`   Running: ${command.join(' ')}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start '${command.join(' ')}': ${error.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ Completed: ${stepName}`);
        resolve();
      } else {
        reject(new Error(`Step '${stepName}' exited with code ${code}`));
      }
    });
  });
}

async function main(): Promise<void> {
  const results: Array<{ name: string; status: 'success' | 'failed'; error?: string }> = [];

  for (const step of STEPS) {
    try {
      await runCommand(step.name, step.command);
      results.push({ name: step.name, status: 'success' });
    } catch (error: any) {
      const message = error?.message || 'Unknown error';
      console.error(`❌ ${step.name} failed: ${message}`);
      results.push({ name: step.name, status: 'failed', error: message });
      console.log('\nPipeline aborted due to failure.');
      break;
    }
  }

  console.log('\nSummary:');
  for (const result of results) {
    if (result.status === 'success') {
      console.log(`  ✅ ${result.name}`);
    } else {
      console.log(`  ❌ ${result.name} — ${result.error}`);
    }
  }

  const pipelineFailed = results.some((step) => step.status === 'failed');
  if (pipelineFailed) {
    process.exitCode = 1;
  } else {
    console.log('\n🎉 Debate scoring pipeline completed successfully.');
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error running debate scoring pipeline:', error);
  process.exit(1);
});











