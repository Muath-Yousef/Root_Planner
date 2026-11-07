# لغة التصميم التصريحية (DSL) — المراحل 1–3

بناء مخطط بوصف ما تريد، لا بكتابة TypeScript. المخطط يصبح نص YAML يقرؤه الإنسان
ويراجعه المؤسس قبل توليده — ثم يترجمه المترجم (`src/dsl/compiler.ts`) إلى ملف
`.socroot.json` بصيغة v2 القائمة، باستخدام مصنع الموظفين نفسه
(`templateNodeData` / `makeEmployeeConfig`) وسجل الأدوار نفسه، لا مصنع موازٍ.

## مثال

أول مثال كامل هو خريطة v3 (محفظة 3 خطوط): `examples/influencers_system_v3.yaml`
— 104 أسطر بدل ~475 سطر TypeScript في المولّد — وتُترجم إلى
`examples/influencers_system_v3.socroot.json` **بايتاً مطابقاً**
(البصمة `ac9f0478…`، انظر `tests/dsl-compiler.test.ts`). منذ المرحلة 2،
أبناء القسم فيها على الشبكة (`lane`/`row`) والقسم يُحجَّم تلقائياً؛
ومنذ المرحلة 3، خطوطها الثلاثة قالب واحد في قسم `lines:` (انظر أدناه)
يُنسخ 3 مرات — بلا `employee_id` يدوي في الملف كله؛
العقد العليا فقط ما زالت بإحداثيات صريحة (انظر `docs/LAYOUT.md`).

```yaml
project:
  id: proj-influencers-system-v3
  name: منظومة المؤثرين (v3)
  tenant: socroot-core
  tenant_name: Sovereign Core
  isolation: logical_rls
  horizon: TRANSITIONAL
  created_at: '2026-11-07T06:19:00.000Z'   # مثبّت: نفس الملف يعيد نفس البصمة

defaults: { department: dept_influencer_system, manager: inf.manager.v1, prefix: inf }
roles: { source: src/registry/roles/influencer.ts, custom: [collector, content_selector, creator] }
configs: { model_routing: preset, sources_watchlist: preset, pricing_config: preset }
layout: { step_x: 320, step_y: 170, pad: 40 }

nodes:
  - { id: founder, role: founder, at: [0, 300], label: المؤسس }
  - { id: mgr, role: manager, lane: 0, row: 2, label: مدير قطاع المؤثرين, status: PLANNED, parent: zone_dept }
  # … 39 عقدة، عقدة واحدة في كل سطر، بنفس ترتيب الملف المولَّد

edges:
  - { from: founder, to: orch, kind: OBJECTIVE_ROUTE }
  - { from: mgr, to: [scout, collector, transformer, ...], kind: TASK_DISPATCH_RESULT }
  - { from: [drf_1, drf_2, drf_3], to: [creator_profile_1, creator_profile_2, creator_profile_3], kind: MEMORY_BUS, access: read }
  # … 30 سطراً توسّع إلى 67 رابطاً
```

## الأقسام

| القسم | ماذا يحمل |
| --- | --- |
| `project` | `id` / `name` / `tenant` (+ `tenant_name`، `isolation`، `horizon`) و`created_at` الاختياري. التاريخ المثبّت يجعل البناء حتمياً؛ خيار المترجم `now` يغلبه. |
| `defaults` | افتراضات المصنع لكل عقد موظف: `department` و`manager` و`prefix` (افتراضياً `inf`). |
| `roles` | `source`: مسار ملف الأدوار المخصصة (نسبةً إلى جذر المستودع؛ الـ CLI في المرحلة 4 يحمّله ويمرّر تعريفاته إلى المترجم)؛ `custom`: معرفات الأدوار المخصصة. |
| `configs` | الإعدادات الثلاثة لصيغة v2؛ قيمة كل منها `preset` (تُحلّ من `src/dsl/presets.ts`) أو نص مضمّن حرفياً. إن حُذف القسم كله، تُستخدم الإعدادات الجاهزة الثلاثة. تُصدَّر دائماً بالترتيب القانوني. |
| `layout` | معاملات شبكة التخطيط (المرحلة 2): `step_x` و`step_y` و`pad` — افتراضياتها 320/170/40. إن حُذف القسم، تسري الافتراضيات. التفصيل في `docs/LAYOUT.md`. |
| `lines` | قالب خط واحد + عدده (المرحلة 3): `count` و`nodes` — انظر «الخطوط» أدناه. |
| `nodes` | قائمة مسطّحة **بالترتيب الذي يظهر في الملف المولَّد** — عقد صريحة ومراسٍ (`{ lines: … }`) تفتح القالب في موضعها. |
| `edges` | قائمة الروابط (انظر التوسيع أدناه). |

## العقد

```
- { id, role, at?: [x, y], lane?, row?, label?, status?, prefix?, employee_id?, name?,
    size?, department_id?, parent? }
```

- `id` و`role` مطلوبان. والموضع واحد من اثنين لا غير: `at` صريح
  (تجاوز يدوي)، أو `lane` + `row` معاً على شبكة `layout` (المرحلة 2،
  انظر `docs/LAYOUT.md`) — كلاهما معاً خطأ، ولا واحد منهما خطأ.
  خليتان متطابقتان في الأب نفسه خطأ.
- `label` الافتراضي: التسمية الإنجليزية للدور (قاعدة المصنع). `status` الافتراضي:
  حالة تنفيذ الدور في السجل. في مثال v3 تُكتب الحالات الصريحة فقط حيث تختلف
  عن افتراضي السجل (مثلاً كل موظف `PLANNED` بينما افتراضي السجل `IMPLEMENTED`).
- `parent`: معرف عقدة منطقة — تصبح العقدة ابناً لها (`parentId` + `extent: 'parent'`).
- `size: [w, h]` و`department_id`: للمناطق فقط؛ `size` يولّد `style` و`zIndex: -1`.
  منذ المرحلة 2، `size` اختياري: إن حُذف حُجّمت المنطقة تلقائياً من
  أبنائها؛ وإن وُجد غلب القاعدة (منطقة الويب في v3 مثالاً).
- `employee_id` و`name`: تُمرَّران إلى مصنع الموظفين (للعقد الصريحة).
  في مثيلات الخطوط (انظر «الخطوط» أدناه) يُشتق `employee_id` تلقائياً
  (`inf.<role>_<n>.v1`) ولا يُكتب يدوياً أبداً؛ وبدونهما يشتق المصنع
  `inf.<role>.v1` للعقدة الواحدة.
- الأدوار المخصصة (`roles.custom`) تُبنى بالشكل الحرفي نفسه الذي يبنيه مولّد v3
  (`label, kind, role, networkMode, status, employee`)؛ وتعريفاتها تُمرَّر إلى
  المترجم عبر خيار `customRoles` — المترجم **لا يسجّلها** في سجل الاستوديو العام.
  ملف الأدوار يحمّله الـ CLI من `roles.source` (المرحلة 4، انظر `docs/ROLES.md`).
  **قاعدة منذ المرحلة 4:** دور معلن في `roles.custom` ومسجّل في الاستوديو
  في آن واحد يُقبل **فقط** حين يطابق التعريف الممرَّر التعريف المسجّل
  تماماً — والمترجم يرفض أي تعريف متعارض. السبب بايتات: الفرع الحرفي
  يصدر `networkMode` قبل `status`، بينما `templateNodeData` (فرع السجل)
  يصدر `status` قبلها؛ فتوجيه دور مسجّل عبر فرع السجل يغيّر بايتات الملف
  المولَّد. لذلك تبقى مواصفة v3 تعلن أدوارها الثلاثة مخصصة رغم تسجيلها —
  ومصدر الحقيقة واحد (`src/registry/roles/influencer.ts`) يحرسه اختبار
  الانحراف. دور مسجّل غير معلن مخصصاً يُبنى عبر فرع السجل مباشرة.
- **بوابة أخيرة:** بعد كل الأخطاء البنيوية، يرفض المترجم أي توليد
  تتداخل فيه عقدتان على اللوحة (احتواء المنطقة لأبنائها ليس تداخلاً).

## الخطوط (`lines:`) — المرحلة 3

«خط إنتاج واحد، N مثيلات» — لا نسخ ولصق لعقد، ولا تمرير `employee_id`
يدوياً أبداً. قالب واحد يصف الخط (خلية إنتاج + سجل دخل)، وعدد يقول كم
مرة يُنسخ:

```yaml
lines:
  count: 3
  nodes:
    - { id: "content_selector_{n}", role: content_selector, lane: 3, row: "{n}", label: "مختار المحتوى {n}", name: "Content Selector {n}", parent: zone_dept }
    - { id: "creator_{n}", role: creator, lane: 4, row: "{n}", label: "صانع المحتوى {n}", name: "Creator {n}", parent: zone_dept }
    - { id: "drf_{n}", role: drafter, lane: 5, row: "{n}", label: "الصائغ {n}", status: PLANNED, name: "Drafter {n}", parent: zone_dept }
    - { id: "creator_profile_{n}", role: l2, lane: 6, row: "{n}", label: "L2 — ملف صانع المحتوى {n}", status: PLANNED, parent: zone_dept }
    - { id: "income_register_{n}", role: l2, at: [2760, 680], step: [0, 170], label: "L2 — سجل مصادر الدخل {n}", status: PLANNED }
```

- **`{n}` هو رقم الخط (1..count).** يجب أن يظهر في `id` كل عقدة قالب
  (بدونه تتصادم المثيلات على المعرف نفسه)، ويجوز في `label` و`name`
  و`employee_id`؛ ولا يجوز في `parent` و`prefix` (ثابتان لكل المثيلات).
  في YAML يُكتب `{n}` بين علامتي تنصيص حيث يبدأ به القيمة (`row: "{n}"`)
  أو داخل تدفق (`{ id: "creator_{n}", … }`) — بلا تنصيص يقرأه محلل YAML
  كمجموعة تدفق لا كنص، فيفشل التحليل.
- **`row: "{n}"`** تعني أن صف المثيل هو رقم خطه — خط `n` في الصف `n`
  (شبكة v3 تضع الخطوط في الصفوف 1..3). أما `row: after-lines` (للعقد
  الصريحة فقط) فتعني الصف الذي يلي آخر خط مباشرة (`count + 1`) — صف
  العمليات المشتركة في v3 (الناشر ومن معه).
- **`step: [dx, dy]`** (مع `at:` فقط) يزيح كل مثيل لاحق: المثيل `k` عند
  `at + (k − 1) × step`. سجلات الدخل في v3 عند `[2760, 680]` بخطوة
  `[0, 170]` — السجل الثاني عند 850 والثالث عند 1020.
- **`employee_id` يُشتق تلقائياً** للمثيلات من الأدوار الموظفة:
  `<prefix>.<role>_<n>.v1` (مثلاً `inf.creator_1.v1`) — بدالة المصنع
  نفسها (`employeeId`) فلا يفترق الاشتقاق عن المصنع. الأدوار غير الموظفة
  (مثل `l2`) لا تأخذ `employee_id`. إن كُتب `employee_id` صراحةً في
  القالب وجب أن يحمل `{n}`.
- **المراسي:** القالب وحده لا يضع شيئاً — مواضع التوسيع مراسٍ في قائمة
  `nodes`، كل مرساة توسّع عقد القالب المذكورة فيها، خطاً خطاً (كل خط
  بعقده بالترتيب المذكور)، في موضع المرساة نفسه:

```yaml
nodes:
  - { id: str, role: strategist, lane: 3, row: 0, … }
  - { lines: ["content_selector_{n}", "creator_{n}", "drf_{n}", "creator_profile_{n}"] }
  - { id: publisher, role: integration_spec, lane: 3, row: after-lines, … }
  # …
  - { lines: ["income_register_{n}"] }
```

  مرساة `{ lines: true }` توسّع كل عقد القالب التي لم تُدَّعَ بعد، بترتيب
  القالب. **كل عقدة قالب تُدَّعى في مرساة واحدة بالضبط** — بلا مرساة
  تختفي صامتة، وبمرساتين تتكرر؛ المترجم يرفض الحالتين بالاسم.
- **الروابط من القالب نفسه:** طرف يحمل `{n}` يجب أن يكون معرف عقدة قالب
  كما هو، فيتوسع إلى مثيلاتها كلها — بلا سرد يدوي للأرقام:

```yaml
  - { from: transformer, to: "income_register_{n}", kind: MEMORY_BUS, access: write }
  - { from: "drf_{n}", to: "creator_profile_{n}", kind: MEMORY_BUS, access: read }
  - { from: kill, to: "creator_{n}", kind: KILL_PLANE_SIGNAL }
```

  الطرف الواحد `{n}` يتوسع إلى القائمة كاملة (توزيع من مصدر واحد،
  أو اقتران ثنائي إن حمل الطرفان `{n}` — الصائغ إلى ملفه فقط، لا إلى
  ملف خط آخر). وسلسلة متتالية من أطراف `{n}` في قائمة واحدة تتوسع
  **خطاً خطاً** لا دوراً دوراً: `[content_selector_{n}, creator_{n}, drf_{n}]`
  تصبح `content_selector_1, creator_1, drf_1, content_selector_2, …` —
  وهو ترتيب إسناد المدير في v3 بالضبط.
- **القالب المعلم:** `src/presets/portfolio.ts` — `buildPortfolioProject({ lines })`
  (الافتراضي 3) يبني المواصفة نفسها برمجياً ويترجمها بالمترجم نفسه
  (`compileSpec`)، فيبدأ المستخدم محفظة جديدة من القالب لا من ملف YAML.
  عند `lines: 3` (مع معرف v3 وتاريخ بنائه) يعيد ملف v3 المسلَّم بايتاً
  مطابقاً — الاختبار يحرس ذلك.
- **حدّ موثّق:** صف `after-lines` يتبع العدد، لكن المواضع العليا الصريحة
  (`pe` و`bg` والقاطع) صُحّحت على `count: 3` — فتغيير العدد في ملف YAML
  إلى 4 يصطدم بالسجل الرابع (المترجم يرفض التداخل مسمّياً العقدتين)،
  لا يولّد خريطة مشوّهة صامتة. القالب المعلَّم يزيح تلك المواضع pitch
  واحداً لكل خط إضافي، فهو المسار المعلَّم لأكثر من 3 خطوط — حتى يقرر
  المؤسس نموذجاً للتركيب العلوي (خارج نطاق المرحلة 3، انظر `docs/LAYOUT.md`).

## الروابط

```
- { from, to, kind, access? }
```

- `kind` واحد من الأنواع الستة (`OBJECTIVE_ROUTE`، `TASK_DISPATCH_RESULT`،
  `ESCALATION_PATH`، `MEMORY_BUS`، `EGRESS_NETWORK`، `KILL_PLANE_SIGNAL`).
- `access` (‏`read`/`write`) يخص `MEMORY_BUS` فقط وافتراضيه `read` — قاعدة `mkEdge` نفسها.
- **التوسيع:** سلسلة واحدة في كل طرف = رابط واحد. قائمة في طرف واحد = توزيع
  (رابط لكل عنصر بالترتيب المذكور). قائمتان معاً = اقتران ثنائي بنفس الطول
  (مثلاً ثلاثة صائغين إلى ملفاتهم الثلاثة في سطر واحد)؛ وطولان مختلفان خطأ.

## الأخطاء

أي خطأ بنيوي يرفع `DslError` يذكر **السطر والحقل** بالعربية — مثلاً:

```
سطر 7 — الدور "no_such_role" غير معروف — ليس في سجل الاستوديو ولا معلناً في roles.custom
```

خطأ صياغة YAML يذكر سطره من محلل YAML نفسه. المترجم يتحقق بنيوياً فقط؛
صحة الطوبولوجيا يحكم عليها الاستوديو نفسه (`parseProjectText` و`checkCable`
و`collectProblems`) — لا مدقق موازٍ هنا.

## سطر الأوامر (CLI) — المرحلة 4

`npm run cli -- …` — تحقق وبناء وتصدير من الطرفية، بنفس دوال المحرك
التي يستدعيها التطبيق (لا منطق مكرر). التفصيل في `docs/ROLES.md`.

```
npm run cli -- validate examples/influencers_system_v3.socroot.json
npm run cli -- build examples/influencers_system_v3.yaml --out /tmp/v3.socroot.json
npm run cli -- export examples/influencers_system_v3.yaml --out /tmp/v3-copy.socroot.json
```

- `validate <file>`: يقبل `.socroot.json` أو YAML؛ خروج 0 عند 0 أخطاء
  (التحذيرات — مثل 21 تحذير `ORG-003` على v3 — لا تُفشل).
- `build <spec.yaml>`: يترجم YAML (يحمّل الأدوار من `roles.source`)
  إلى `.socroot.json`؛ حتمي حين يكون `created_at` مثبّتاً في المواصفة
  أو حين يُمرَّر `--now <iso>`؛ بناء v3 يعيد الملف المسلَّم بايتاً
  مطابقاً (البصمة `ac9f0478…`).
- `export <file> --out <file>`: نسخة قانونية موثقة من مشروع سليم إلى
  مسار مختار؛ يرفض مشروعاً فاشل التحقق.

## ما ليس في هذه المرحلة (عمداً)

- التخطيط التلقائي موجود منذ المرحلة 2 (`docs/LAYOUT.md`) — لكن العقد
  العليا ما زالت بإحداثيات صريحة لأن تركيبها يدوي بلا قاعدة منتظمة؛
  وتغيير `count` في ملف YAML فوق 3 يصطدم بتلك المواضع (انظر «الخطوط»
  أعلاه) — القالب المعلَّم هو المسار المعلَّم لأكثر من 3 خطوط.
- لا تغيير في صيغة v2 ولا في سلوك المصنع ولا في الصلاحيات الافتراضية.
