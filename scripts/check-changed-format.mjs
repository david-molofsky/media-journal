import { execFileSync } from 'node:child_process';

const supportedExtension = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|css|html)$/i;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

let base;
try {
  base = git('merge-base', 'HEAD', 'origin/main');
} catch {
  base = git('rev-parse', 'HEAD^');
}

const files = git('diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`)
  .split('\n')
  .filter((file) => file && supportedExtension.test(file));

if (files.length === 0) {
  console.log('No changed files require a formatting check.');
  process.exit(0);
}

execFileSync('npx', ['prettier', '--check', ...files], { stdio: 'inherit' });
