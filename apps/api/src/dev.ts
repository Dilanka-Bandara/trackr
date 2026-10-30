import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const resolveDependency = createRequire(resolve(process.cwd(), 'package.json'));
const children = ['src/main.ts', 'src/worker.ts'].map((file) =>
  spawn(process.execPath, [resolveDependency.resolve('tsx/cli'), 'watch', file], {
    stdio: 'inherit',
  }),
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
