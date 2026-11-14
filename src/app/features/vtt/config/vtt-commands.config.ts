export type VttChatCommandAction =
  | 'roll'
  | 'gm_roll'
  | 'whisper'
  | 'ooc'
  | 'emote'
  | 'clear'
  | 'help';

export interface VttChatCommandConfig {
  action: VttChatCommandAction;
  primary: string;
  aliases: readonly string[];
  usage: string;
  description: string;
  gmOnly?: boolean;
}

export const VTT_CHAT_COMMANDS: readonly VttChatCommandConfig[] = [
  {
    action: 'roll',
    primary: '/r',
    aliases: ['/roll'],
    usage: '<formula>',
    description: 'Roll dice publicly to the room',
  },
  {
    action: 'gm_roll',
    primary: '/gmr',
    aliases: ['/gmroll', '/gr'],
    usage: '<formula>',
    description: 'Roll dice privately to yourself and the GM',
  },
  {
    action: 'whisper',
    primary: '/w',
    aliases: ['/whisper', '/tell', '/pm'],
    usage: '<gm | player> <message>',
    description: 'Send a private message to the GM or a player',
  },
  {
    action: 'ooc',
    primary: '/ooc',
    aliases: ['/o'],
    usage: '<message>',
    description: 'Speak out of character using your player name',
  },
  {
    action: 'emote',
    primary: '/me',
    aliases: ['/em', '/emote'],
    usage: '<action>',
    description: 'Perform an in-character action emote',
  },
  {
    action: 'clear',
    primary: '/clear',
    aliases: ['/cls'],
    usage: '',
    description: 'Clear all campaign log entries',
    gmOnly: true,
  },
  {
    action: 'help',
    primary: '/help',
    aliases: ['/?'],
    usage: '',
    description: 'Display available slash commands and shorthands',
  },
];

export function normalizeSlashTrigger(raw: string): string {
  const trimmed = (raw ?? '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function getAllCommandTriggers(cmd: VttChatCommandConfig): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [cmd.primary, ...cmd.aliases]) {
    const norm = normalizeSlashTrigger(item);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

export function getCommandConfigByAction(
  action: VttChatCommandAction,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): VttChatCommandConfig | undefined {
  return registry.find((cmd) => cmd.action === action);
}

export function getPrimaryCommandTrigger(
  action: VttChatCommandAction,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): string {
  const found = getCommandConfigByAction(action, registry);
  return found ? normalizeSlashTrigger(found.primary) : `/${action}`;
}

export interface ResolvedSlashCommand {
  config: VttChatCommandConfig;
  matchedTrigger: string;
  rest: string;
}

export function resolveSlashCommand(
  rawInput: string,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): ResolvedSlashCommand | null {
  const trimmedStart = (rawInput ?? '').trimStart();
  if (!trimmedStart.startsWith('/')) {
    return null;
  }

  const spaceIdx = trimmedStart.search(/\s/);
  const rawTrigger =
    spaceIdx === -1 ? trimmedStart : trimmedStart.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : trimmedStart.slice(spaceIdx + 1).trim();
  const normalizedTrigger = rawTrigger.toLowerCase();

  for (const cmd of registry) {
    const triggers = getAllCommandTriggers(cmd);
    if (triggers.includes(normalizedTrigger)) {
      return {
        config: cmd,
        matchedTrigger: rawTrigger,
        rest,
      };
    }
  }

  return null;
}

export function isUnknownSlashCommand(
  rawInput: string,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): string | null {
  const trimmedStart = (rawInput ?? '').trimStart();
  if (!trimmedStart.startsWith('/')) {
    return null;
  }
  if (resolveSlashCommand(trimmedStart, registry)) {
    return null;
  }
  const spaceIdx = trimmedStart.search(/\s/);
  return spaceIdx === -1 ? trimmedStart : trimmedStart.slice(0, spaceIdx);
}

export function findMatchingSlashCommands(
  rawTokenPrefix: string,
  isGm: boolean,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): VttChatCommandConfig[] {
  const q = normalizeSlashTrigger(rawTokenPrefix);
  if (!q) return [];

  return registry.filter((cmd) => {
    if (cmd.gmOnly && !isGm) return false;
    const triggers = getAllCommandTriggers(cmd);
    return triggers.some((t) => t.startsWith(q));
  });
}
