import 'dotenv/config';
import { spawn } from 'node:child_process';

function getISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekRange(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - 1); // yesterday to ensure data settled
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: getISODate(start), end: getISODate(end) };
}

async function run(): Promise<void> {
  const range = getWeekRange();
  console.log(`🧮 Running debate metrics for ${range.start} → ${range.end}`);

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npxCommand, ['tsx', 'scripts/calc-debate-metrics.ts', '--start', range.start, '--end', range.end], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });

  await new Promise<void>((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`calc-debate-metrics exited with code ${code}`));
    });
    child.on('error', reject);
  });

  console.log('✅ Weekly debate metrics complete');
}

run().catch((error) => {
  console.error('❌ Failed to run weekly debate metrics:', error);
  process.exit(1);
});


