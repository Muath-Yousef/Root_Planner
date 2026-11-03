import { cablingMessages } from './cabling';
import { cliMessages } from './cli';
import { policyMessages } from './policy';
import { breakGlassMessages, gateMessages } from './breakGlass';

const allMessages: Record<string, { en: string; ar: string }> = {
  ...cablingMessages,
  ...cliMessages,
  ...policyMessages,
  ...breakGlassMessages,
  ...gateMessages,
};

export function translateEngineMessage(
  code: string | undefined,
  lang: 'en' | 'ar',
  fallback?: string
): string {
  if (!code) return fallback ?? '';
  const entry = allMessages[code];
  if (entry) {
    return entry[lang] ?? entry.en;
  }
  return fallback ?? code;
}

export { cablingMessages, cliMessages, policyMessages, breakGlassMessages, gateMessages };
