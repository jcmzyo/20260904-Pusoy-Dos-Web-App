import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourceRoot = new URL('../src/', import.meta.url).href;

// The existing source uses extensionless/directory imports and parameter properties.
// Load it with the installed TypeScript compiler without emitting or rewriting files.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot)) {
      const base = new URL(specifier, context.parentURL).href;
      for (const suffix of ['.ts', '/index.ts']) {
        if (existsSync(new URL(base + suffix))) return { url: base + suffix, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.ts')) {
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        fileName: fileURLToPath(url), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText };
    }
    return nextLoad(url, context);
  },
});

const { runTraceCommand } = await import('../src/simulation/SimulationTraceCommand.ts');
process.exitCode = await runTraceCommand(process.argv.slice(2), {
  log: (text) => process.stdout.write(text),
  error: (text) => process.stderr.write(`${text}\n`),
  save: (path, text) => writeFile(path, text, { encoding: 'utf8', flag: 'wx' }),
});
