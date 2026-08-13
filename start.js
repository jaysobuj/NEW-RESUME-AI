#!/usr/bin/env node
// ==========================================================
// start.js — runs backend + frontend together, from the repo root.
//
// Run it with: node start.js   (or double-click start.bat on Windows,
// or ./start.sh on Mac/Linux)
//
// Press Ctrl+C once to stop both servers.
// ==========================================================

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const ROOT = __dirname;
const IS_WIN = process.platform === 'win32';

const SERVICES = [
  { name: 'BACKEND', dir: path.join(ROOT, 'backend'), colour: 36 /* cyan */ },
  { name: 'FRONTEND', dir: path.join(ROOT, 'frontend'), colour: 35 /* magenta */ },
];

function paint(code, text) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function checkPrereqs() {
  const envPath = path.join(ROOT, 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ backend/.env is missing. Run "node setup.js" first (or setup.bat / ./setup.sh).');
    process.exit(1);
  }
  for (const svc of SERVICES) {
    if (!fs.existsSync(path.join(svc.dir, 'node_modules'))) {
      console.error(`❌ ${svc.dir}/node_modules is missing. Run "node setup.js" first (or setup.bat / ./setup.sh).`);
      process.exit(1);
    }
  }
}

const children = [];

function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (IS_WIN) {
      // /T kills the whole process tree, /F forces it — needed because
      // npm start spawns further child processes (react-scripts, etc.)
      // that a plain child.kill() would otherwise leave orphaned.
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      // Started with detached: true below, so the child is its own
      // process group leader — signalling -pid reaches every process
      // in that group, not just the immediate child.
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch (e) {
    // Already exited — nothing to do.
  }
}

function shutdown() {
  console.log('\nStopping both servers...');
  children.forEach(killTree);
  setTimeout(() => process.exit(0), 300);
}

function startService(svc) {
  const child = spawn('npm', ['start'], {
    cwd: svc.dir,
    shell: true, // required on Windows to resolve npm.cmd
    detached: !IS_WIN, // gives POSIX children their own killable process group
  });
  children.push(child);

  const prefix = paint(svc.colour, `[${svc.name}]`);

  const pipe = (stream) => {
    const rl = readline.createInterface({ input: stream });
    rl.on('line', (line) => console.log(`${prefix} ${line}`));
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  return child;
}

checkPrereqs();

console.log('');
console.log('Starting ResumeAI — backend on :5000, frontend on :3000');
console.log('Press Ctrl+C to stop both.');
console.log('');

SERVICES.forEach(startService);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
