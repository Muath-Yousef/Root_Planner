#!/usr/bin/env node
import * as path from 'node:path';
import { buildFile, exportFile, validateFile } from './commands';
import { registerRolesFile } from './roles';

/**
 * Phase 4 — headless CLI entry (`npm run cli -- <command> …`).
 *
 *   validate <file>                 تحقق من .socroot.json أو YAML بأدوات الاستوديو نفسها
 *   build <spec.yaml> [--out <f>] [--now <iso>]   ترجمة YAML إلى .socroot.json حتمياً
 *   export <file> --out <file>      نسخة قانونية موثقة من مشروع سليم إلى مسار مختار
 *   roles register <file>           تسجيل دور (أدوار) من ملف RoleDefinition (المرحلة 4ب)
 *
 * Exit code 0 on success, 1 on any failure. No browser, no UI.
 * Arabic-first messages; technical identifiers stay in English.
 */

const USAGE = `socroot-cli — واجهة سطر أوامر استوديو Root Planner (بلا واجهة رسومية)

الاستخدام:
  npm run cli -- validate <file>                  تحقق من ملف .socroot.json أو YAML
  npm run cli -- build <spec.yaml> [--out <file>] [--now <iso>]
                                                  ترجمة مواصفة YAML إلى .socroot.json
  npm run cli -- export <file> --out <file>       تصدير نسخة قانونية من مشروع سليم
  npm run cli -- roles register <file>            تسجيل دور (أدوار) من ملف RoleDefinition

الخيارات:
  --out <file>   مسار الخرج (build: افتراضياً بجانب المواصفة بالامتداد .socroot.json؛ export: مطلوب)
  --now <iso>    تثبيت الطابع الزمني للبناء (build فقط؛ بدونه يُستخدم created_at المثبّت في المواصفة، أو الوقت الحالي)
  --help, -h     هذه الرسالة

أمثلة:
  npm run cli -- validate examples/influencers_system_v3.socroot.json
  npm run cli -- build examples/influencers_system_v3.yaml --out /tmp/v3.socroot.json
  npm run cli -- export examples/influencers_system_v3.yaml --out /tmp/v3-copy.socroot.json
  npm run cli -- roles register ./my-role.ts
`;

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

interface Flags { out?: string; now?: string; positional: string[] }

function parseFlags(args: string[]): Flags {
  const flags: Flags = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--out' || a === '--now') {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) die(`الخيار ${a} يحتاج قيمة — انظر --help`);
      if (a === '--out') flags.out = v;
      else flags.now = v;
      i++;
    } else if (a.startsWith('--')) {
      die(`خيار غير معروف: ${a} — انظر --help`);
    } else {
      flags.positional.push(a);
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === undefined || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(USAGE);
    if (cmd === undefined) process.exit(1);
    return;
  }
  const flags = parseFlags(rest);
  if (cmd === 'roles') {
    const [sub, ...subRest] = flags.positional;
    if (sub !== 'register') die(`أمر roles غير معروف: ${sub ?? '—'} — المتاح: roles register <file> — انظر --help`);
    if (flags.out !== undefined || flags.now !== undefined) die('أمر roles register لا يقبل خيارات --out أو --now — انظر --help');
    const file = subRest[0];
    if (file === undefined) die('أمر roles register يحتاج ملفاً — انظر --help');
    if (subRest.length > 1) die(`أمر roles register يقبل ملفاً واحداً — أُعطي: ${subRest.join('، ')}`);
    const result = await registerRolesFile(file);
    const rel = path.relative(process.cwd(), result.dest);
    console.log(`✓ سُجّل ${result.ids.length === 1 ? 'الدور' : 'الأدوار'} ${result.ids.join('، ')} — ${rel}${result.indexChanged || result.copied ? '' : ' (كان مسجلاً أصلاً)'}`);
    return;
  }
  const input = flags.positional[0];
  if (input === undefined) die(`أمر ${cmd} يحتاج ملفاً — انظر --help`);
  if (flags.positional.length > 1) die(`أمر ${cmd} يقبل ملفاً واحداً — أُعطي: ${flags.positional.join('، ')}`);

  if (cmd === 'validate') {
    const report = await validateFile(input);
    if (report.ok) {
      console.log(`✓ ${input}: 0 أخطاء، ${report.warnings.length} تحذيراً — ${report.nodes} عقدة، ${report.edges} رابطاً`);
      for (const w of report.warnings) console.log(`  تحذير — ${w}`);
    } else {
      console.error(`✗ ${input}: ${report.errors.length} خطأ`);
      for (const e of report.errors) console.error(`  خطأ — ${e}`);
      process.exit(1);
    }
    return;
  }

  if (cmd === 'build') {
    if (flags.out !== undefined && flags.out === input) die('مسار الخرج --out يجب أن يختلف عن ملف الإدخال');
    const result = await buildFile(input, { out: flags.out, now: flags.now });
    console.log(`✓ ${result.outPath}: ${result.nodes} عقدة، ${result.edges} رابطاً — sha256 ${result.sha256}`);
    return;
  }

  if (cmd === 'export') {
    if (flags.out === undefined) die('أمر export يحتاج --out <file> — انظر --help');
    const result = await exportFile(input, flags.out);
    console.log(`✓ ${result.outPath}: ${result.nodes} عقدة، ${result.edges} رابطاً — sha256 ${result.sha256}`);
    return;
  }

  die(`أمر غير معروف: ${cmd} — انظر --help`);
}

main().catch((e: unknown) => die(e instanceof Error ? e.message : String(e)));
