# 📥 دليل استخدام مساحة Commit والـ Inboxes

هذا الدليل مخصص لأي وكيل ذكاء اصطناعي (AI Agent) أو مطوّر يتفاعل مع منظومة العمل المشتركة في **Root_Planner**.

---

## 🗂️ هيكل المجلدات الداخلي

```
commit/
├── inbox/         # مخصص للـ Implementer (كتابة الحلول والأكواد الجديدة)
├── tasks/         # مخصص للـ Analyzer (تعريف المهام والتحليلات)
├── reviews/       # مخصص للـ Reviewer (ملاحظات المراجعة واعتماد الـ PRs)
├── INBOX_GUIDE.md # هذا الدليل التوجيهي
└── .done/         # أرشيف تلقائي ينقله الـ Watcher بعد الرفع الناجح
    ├── success/   # الملفات التي تم رفعها بنجاح إلى GitHub
    └── failed/    # تقارير الفشل في حال حدوث خطأ شبكة أو أذونات
```

---

## 🧭 ما الذي يجب وضعه في كل مجلد؟

### 1. `commit/inbox/` (المطوّر / Implementer)
- ضع ملفات المشروع التي قمت بتعديلها أو إنشائها هنا.
- سيقوم الـ Watcher التلقائي (`push-commit.sh`) بتوجيه كل ملف إلى مساره الصحيح داخل المشروع:
  - ملفات TypeScript/React (`.ts`, `.tsx`, `.css`) ← تُنقل إلى `src/`
  - اختبارات الوحدة (`*.test.ts`, `*.test.tsx`) ← تُنقل إلى `tests/`
  - المخططات (`*.schema.json`) ← تُنقل إلى `src/schemas/`
  - التوثيقات (`*.md`) ← تُنقل إلى `docs/`
- **لإنشاء فرع ومراجعة تلقائية (PR):**
  استخدم الأمر:
  ```bash
  bash scripts/push-commit.sh --pr TASK_ID
  ```

### 2. `commit/tasks/` (المحلل / Analyzer)
- يكتب المحلل ملفات المهام الجديدة بصيغة: `TASK_<TIMESTAMP>_<slug>.md`.
- يقوم الـ Watcher بنقلها فوراً إلى `docs/pipeline/tasks/` ورفعها إلى GitHub ليراها باقي الوكلاء.
- يفضل استخدام أداة MCP: `create_task()` التي تتكفل بكتابة الحقول القياسية.

### 3. `commit/reviews/` (المراجع / Reviewer)
- يكتب المراجع ملاحظات المراجعة بصيغة: `REVIEW_<PR_OR_BRANCH>_<TIMESTAMP>.md`.
- يقوم الـ Watcher بنقلها إلى `docs/pipeline/reviews/` ورفعها فوراً.
- يفضل استخدام أداة MCP: `submit_review_note()`.

### 4. `commit/.done/` (الأرشيف الآلي)
- يُدار آلياً بواسطة المنظومة.
- لا تضع فيه أي ملفات يدوياً.
- إذا فشل الرفع لسبب ما (شبكة، تعارض)، ستجد تقريراً مفصلاً داخل:
  `commit/.done/failed/<timestamp>/PUSH_FAILURE.txt` مع بقاء النسخ في الـ inbox لإعادة المحاولة.

---

## ⚡ فحص حالة المنظومة
يمكنك التحقق من حالة المعالجة الحالية عبر:
```bash
bash scripts/pipeline-status.sh
```
