# لغة التصميم التصريحية (DSL) — المرحلتان 1 و2

بناء مخطط بوصف ما تريد، لا بكتابة TypeScript. المخطط يصبح نص YAML يقرؤه الإنسان
ويراجعه المؤسس قبل توليده — ثم يترجمه المترجم (`src/dsl/compiler.ts`) إلى ملف
`.socroot.json` بصيغة v2 القائمة، باستخدام مصنع الموظفين نفسه
(`templateNodeData` / `makeEmployeeConfig`) وسجل الأدوار نفسه، لا مصنع موازٍ.

## مثال

أول مثال كامل هو خريطة v3 (محفظة 3 خطوط): `examples/influencers_system_v3.yaml`
— 100 سطر بدل ~475 سطر TypeScript في المولّد — وتُترجم إلى
`examples/influencers_system_v3.socroot.json` **بايتاً مطابقاً**
(البصمة `ac9f0478…`، انظر `tests/dsl-compiler.test.ts`). منذ المرحلة 2،
أبناء القسم فيها على الشبكة (`lane`/`row`) والقسم يُحجَّم تلقائياً؛
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
roles: { source: examples/influencer_roles.ts, custom: [collector, content_selector, creator] }
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
| `roles` | `source`: مسار ملف الأدوار المخصصة (توثيقي في هذه المرحلة)؛ `custom`: معرفات الأدوار المخصصة. |
| `configs` | الإعدادات الثلاثة لصيغة v2؛ قيمة كل منها `preset` (تُحلّ من `src/dsl/presets.ts`) أو نص مضمّن حرفياً. إن حُذف القسم كله، تُستخدم الإعدادات الجاهزة الثلاثة. تُصدَّر دائماً بالترتيب القانوني. |
| `layout` | معاملات شبكة التخطيط (المرحلة 2): `step_x` و`step_y` و`pad` — افتراضياتها 320/170/40. إن حُذف القسم، تسري الافتراضيات. التفصيل في `docs/LAYOUT.md`. |
| `nodes` | قائمة مسطّحة **بالترتيب الذي يظهر في الملف المولَّد**. |
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
- `employee_id` و`name`: تُمرَّران إلى مصنع الموظفين (للمثيلات: مثلاً
  `inf.creator_1.v1` / `Creator 1`). بدونهما يشتق المصنع `inf.<role>.v1`.
- الأدوار المخصصة (`roles.custom`) تُبنى بالشكل الحرفي نفسه الذي يبنيه مولّد v3
  (`label, kind, role, networkMode, status, employee`)؛ وتعريفاتها تُمرَّر إلى
  المترجم عبر خيار `customRoles` — المترجم **لا يسجّلها** في سجل الاستوديو العام
  ولا يحمّل ملفها (تحميل الملف من الطرفية في المرحلة 4).
- **بوابة أخيرة:** بعد كل الأخطاء البنيوية، يرفض المترجم أي توليد
  تتداخل فيه عقدتان على اللوحة (احتواء المنطقة لأبنائها ليس تداخلاً).

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

## ما ليس في هذه المرحلة (عمداً)

- التخطيط التلقائي موجود منذ المرحلة 2 (`docs/LAYOUT.md`) — لكن العقد
  العليا ما زالت بإحداثيات صريحة لأن تركيبها يدوي بلا قاعدة منتظمة.
- لا تجريد `lines:`: الخطوط الثلاثة مكتوبة صراحةً (المرحلة 3).
- لا CLI ولا تحميل ملفات أدوار: التعريفات المخصصة تُمرَّر برمجياً (المرحلة 4).
- لا تغيير في صيغة v2 ولا في سلوك المصنع ولا في الصلاحيات الافتراضية.
