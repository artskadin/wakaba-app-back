import pc from 'picocolors';
import { parseArgs } from 'node:util';
import { isAbort } from 'helpers/is-abort';
import { printHelp } from './commands/help';
import { runCheck } from './commands/check';
import { runStatus } from './commands/status';
import { runAudio } from './commands/audio';
import { runBundle } from './commands/bundle';
import { runWhere } from './commands/where';
import { runDiff } from './commands/diff';
import { runApply } from './commands/apply';
import { runEmbed } from './commands/embed';
import { parseEnv } from './db';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      voice: { type: 'string' },
      lesson: { type: 'string' },
      track: { type: 'string' },
      interactive: { type: 'boolean', short: 'i' },
      out: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      'dry-run': { type: 'boolean' },
      env: { type: 'string' },
    },
  });

  const command = positionals[0];
  if (values.help || !command) {
    printHelp();

    return;
  }

  switch (command) {
    case 'check':
      process.exit(runCheck());
      break;
    case 'status':
      process.exit(runStatus());
      break;
    case 'audio':
      process.exit(await runAudio(values));
      break;
    case 'bundle':
      process.exit(runBundle(values));
      break;
    case 'where':
      process.exit(runWhere(positionals[1]));
      break;
    case 'diff':
      process.exit(await runDiff(parseEnv(values.env)));
      break;
    case 'apply':
      process.exit(await runApply(values, parseEnv(values.env)));
      break;
    case 'embed':
      process.exit(await runEmbed(parseEnv(values.env)));
      break;
    default:
      console.error(pc.red(`Неизвестная команда: ${command}`));
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  if (isAbort(err)) {
    process.exit(130);
  }

  console.error(err);
  process.exit(1);
});
