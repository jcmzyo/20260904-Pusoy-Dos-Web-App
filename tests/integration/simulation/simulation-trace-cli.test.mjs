import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../../scripts/simulation-trace.mjs', import.meta.url));
function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
}

describe('standalone simulation trace launcher', () => {
  it('runs public/private seeded Sessions, saves exact console text, and refuses to overwrite files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pusoy-trace-'));
    try {
      const path = join(directory, 'session log.txt');
      const plain = run(['--seed', '1713', '--output', path]);
      expect(plain.error).toBeUndefined();
      expect(plain.status, plain.stderr).toBe(0);
      expect(readFileSync(path, 'utf8')).toBe(plain.stdout);
      expect(plain.stdout).toContain('Session results:');
      expect(plain.stdout).not.toContain('PRIVATE');
      const privateRun = run(['--seed', '1713', '--include-private-hands', '--output', path]);
      expect(privateRun.error).toBeUndefined();
      expect(privateRun.status).toBe(1);
      expect(privateRun.stderr).toContain('EEXIST');
      expect(privateRun.stdout).toContain('PRIVATE remaining hands:');
      expect(privateRun.stdout.split('\n').filter((line) => !line.includes('PRIVATE') && !line.includes('DEVELOPER ONLY')).join('\n')).toBe(plain.stdout);
      expect(readFileSync(path, 'utf8')).toBe(plain.stdout);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60000);

  it('provides help and nonzero argument failures from the real entry point', () => {
    const help = run(['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('Usage: npm run simulate:trace');
    const invalid = run(['--seed', '-1']);
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('unsigned 32-bit decimal integer');
    expect(invalid.stdout).toBe('');
  }, 30000);
});
