# التصدير والمراجعة — المرحلة 5

الصورة والفرق جزء من الاستوديو، لا سكربتات خارجية. أي مخطط يُراجَع بصرياً
ويُقارن بسابقه قبل اعتماده — من الطرفية نفسها، بلا متصفح وبلا واجهة رسومية.

## تصدير الصورة: `export-image`

```bash
npm run cli -- export-image examples/influencers_system_v3.socroot.json --out /tmp/v3.svg
npm run cli -- export-image examples/influencers_system_v3.socroot.json --out /tmp/v3.png
npm run cli -- export-image examples/influencers_system_v3.socroot.json --out /tmp/v3.bin --format png
```

- الصيغة تُستنتج من امتداد `--out` (`.svg` أو `.png`)، أو تُحدَّد بـ `--format`.
- المشروع يُتحقق منه أولاً بأدوات الاستوديو نفسها؛ مشروع فاشل لا تُصدَّر صورته.
- **SVG أولاً:** نصي، حتمي (نفس الملف يعطي نفس البايتات)، قابل للفرق والبحث.
  يُبنى في `src/engine/topologyImage.ts` — نقلٌ لمنطق سكربت الرسم الخارجي
  (`render_topology.py`) الذي رسم الصور المسلَّمة v1/v2/v3: نفس هندسة اللوحة
  (المقياس 1.25، الهوامش، العنوان من الملف نفسه)، ونفس ألوان الكابلات —
  تُقرأ من `CABLE_DEFS` في `src/registry/cables.ts` لا تُنسخ — ونفس قواعد
  الرسم: توزيع النهايات من `edgeEndpointOffsets` (المرحلة 2)، وتسميات على
  المنحنى للأنواع الحاملة للبنية فقط (`OBJECTIVE_ROUTE` / `ESCALATION_PATH` /
  `EGRESS_NETWORK`)، والمفتاح يغطي الباقي.
- **PNG ثانياً:** تحويل الـ SVG نفسه عبر Chromium الخامل الذي يجلبه Playwright
  (اعتمادية تطوير موجودة أصلاً: `@playwright/test`) — بلا اعتمادية جديدة.
  ثبّت المتصفح مرة واحدة:
  ```bash
  npx playwright install chromium
  ```
  وإن لم يكن مثبّتاً، يفشل الأمر برسالة عربية تسمّي هذا الأمر بالذات.
  أبعاد الـ PNG هي أبعاد الـ SVG نفسها (v3 مثلاً: 4175×2153).

### ملاحظة عن عرض العقد

السكربت الخارجي يقيس عرض التسمية بمقاييس الخط الحقيقية (PIL + Noto Sans
Arabic / DejaVu). هذا المصدِّر يعمل بلا محرك خطوط، فيقدّر العرض بجدول
تقدّمات لكل نظام كتابة (`estimateLabelWidth` في `src/engine/topologyImage.ts`)
عُاير مقابل قياسات السكربت لكل تسميات v1/v2/v3: أسوأ فرق في عرض الصندوق
33px، وكل تسمية مسلَّمة تتسع داخل صندوقها المقدَّر. المواضع والروابط لا
تتأثر — العرض يغيّر امتداد الصندوق فقط، لا موضعه.

## الفرق بين نسختين: `diff`

```bash
npm run cli -- diff examples/influencers_system_v2.socroot.json examples/influencers_system_v3.socroot.json
```

يسرد العقد والروابط المضافة والمحذوفة والمتغيّرة بدقة — لا «تغيّر شيء ما».
الهوية هي المعرّف؛ «تغيّرت» تعني نفس المعرّف بمحتوى مختلف (موضع، أب، بيانات،
نمط)، وتُقارن بتسلسل JSON مرتب المفاتيح فلا يُبلَّغ عن تغيير وهمي من ترتيب
المفاتيح. مثال v2 ← v3:

```
الفرق: …v2.socroot.json ← …v3.socroot.json
  العقد: +10 صافياً (أُضيفت 15، حُذفت 5، تغيّرت 23)
  الروابط: +24 صافياً (أُضيفت 36، حُذفت 12، تغيّرت 0)
```

الصافي وحده لا يكفي: v3 استبدلت 5 عقد أحادية الخط بـ 15 عقدة لكل خط،
فالفرق يسرد المضاف والمحذوف كليهما. الاتجاه: `diff <قديم> <جديد>`،
والصافي = الجديد − القديم.

## قائمة المراجعة قبل النشر: `review`

```bash
npm run cli -- review examples/influencers_system_v3.socroot.json
npm run cli -- review examples/influencers_system_v3.socroot.json --against examples/influencers_system_v2.socroot.json
npm run cli -- review examples/influencers_system_v3.socroot.json --against examples/influencers_system_v2.socroot.json --out /tmp/review
```

أربع بوابات، كل واحدة ناجحة أو فاشلة أو متخطاة — بلا نتيجة إجمالية
مبهمة:

| البوابة | ما تفحصه | الفشل يعني |
| --- | --- | --- |
| التحقق (0 أخطاء) | `validate` بأدوات الاستوديو نفسها | المشروع مكسور — لا يُنشر |
| البصمة المستقرة | تسلسل المشروع مرتين يعطي نفس sha256 | البناء غير حتمي |
| الصورة مولَّدة | SVG يُبنى ويحوي كل العقد والروابط | الرسم ناقص |
| الفرق مقروء | الفرق مقابل `--against` يُحسب ويُلخَّص | لا أساس للمقارنة |

بلا `--against` تُتخطى بوابة الفرق (وتُبلَّغ متخطاة لا ناجحة). بلا `--out`
المراجعة للقراءة فقط؛ معه يُحفظ الـ SVG المولَّد في المجلد. رمز الخروج
1 إن فشلت أي بوابة.

## المراجع

- المصدِّر: `src/engine/topologyImage.ts` (SVG) و`src/engine/topologyPng.ts` (PNG).
- الفرق: `src/engine/projectDiff.ts` — `diffProjects` و`formatProjectDiff`.
- الأوامر: `src/cli/commands.ts` (`exportImageFile` / `diffFiles` / `reviewFile`)
  و`src/cli/index.ts`.
- الاختبارات: `tests/export-review.test.ts` — أبعاد اللوحات الثلاث، حتمية
  الـ SVG، عدّ العقد والروابط، ألوان الكابلات، حدود عرض الصندوق مقابل
  السكربت، عدّ الفرق v2→v3، بوابات المراجعة، وتوليد PNG عند توفر Chromium.
