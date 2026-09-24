import type { SimulationConfig } from './SimulationConfig';
import { runRecordedSimulation } from './SimulationRunner';
import { formatSimulationTrace } from './SimulationTraceFormatter';

export const traceUsage = 'Usage: npm run simulate:trace -- --seed <0..4294967295> [--include-private-hands] [--output <file>]';

export function parseTraceArguments(args: readonly string[]): { seed: number; includePrivateHands: boolean; output?: string } {
  let seed: number | undefined;
  let output: string | undefined;
  let includePrivateHands = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (seen.has(argument)) throw new Error(`Duplicate option: ${argument}`);
    seen.add(argument);
    if (argument === '--include-private-hands') includePrivateHands = true;
    else if (argument === '--seed' || argument === '--output') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      if (argument === '--output') output = value;
      else {
        if (!/^\d+$/.test(value) || Number(value) > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit decimal integer.');
        seed = Number(value);
      }
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (seed === undefined) throw new Error('An explicit --seed is required.');
  return { seed, includePrivateHands, ...(output === undefined ? {} : { output }) };
}

export async function runTraceCommand(args: readonly string[], output: { log: (text: string) => void; error: (text: string) => void; save: (path: string, text: string) => Promise<void> }): Promise<number> {
  if (args.length === 1 && args[0] === '--help') {
    output.log(`${traceUsage}\n`);
    return 0;
  }
  let options: ReturnType<typeof parseTraceArguments>;
  try {
    options = parseTraceArguments(args);
  } catch (error) {
    output.error(`${error instanceof Error ? error.message : String(error)}\n${traceUsage}`);
    return 2;
  }
  const config: SimulationConfig = {
    runId: `trace-${options.seed}`, engineSeed: options.seed, mode: 'basic', rulesetId: 'default',
    seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
  };
  const recorded = await runRecordedSimulation(config, { trace: true, includePrivateHands: options.includePrivateHands });
  const text = formatSimulationTrace(recorded, options);
  output.log(text);
  if (options.output) {
    try {
      await output.save(options.output, text);
    } catch (error) {
      output.error(`Seed ${options.seed}: cannot save log to ${options.output}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  return recorded.status === 'completed' ? 0 : 1;
}
