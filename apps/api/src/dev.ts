import { spawn } from 'node:child_process';
const children = ['src/main.ts', 'src/worker.ts'].map((file) =>
  spawn(process.execPath, ['--import', 'tsx', 'watch', file], { stdio: 'inherit' }),
);
function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children)
  child.on('exit', (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  });
