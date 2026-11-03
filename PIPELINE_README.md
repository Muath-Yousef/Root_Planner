# 🤖 AI Multi-Agent Pipeline — Root Planner

منظومة عمل متكاملة متعددة الوكلاء (Multi-Agent Pipeline) تربط بين:
1. **المحلل (Analyzer):** Claude Desktop عبر MCP
2. **المنفّذ (Implementer):** Claude Code / Antigravity / أي بيئة برمجية
3. **المراجع (Reviewer):** Google AI Studio / GitHub PRs / Cursor / أي نموذج أو مراجع بشري

---

## ⚡ البداية السريعة لأي وكيل ذكاء اصطناعي (Quickstart)

إذا كنت وكيلاً جديداً يتصل بهذا المشروع، أول وأهم خطوة هي استدعاء أداة MCP:
```json
get_my_role()
```
تقوم هذه الأداة بقراءة دورك المخصص وتعليمات سير العمل الخاصة بك من `.github/AGENT_ROLES.md` وتعرض لك حالة الاتصال بمستودع GitHub والمهام المتاحة.

---

## 🔄 مسار العمل المتكامل (Workflow Pipeline)

```
[Claude Desktop / Analyzer]
       │
       ▼ (create_task)
[commit/tasks/] ──(push-commit.sh)──► [docs/pipeline/tasks/ على GitHub]
                                                  │
                                                  ▼ (claim_implementer)
                                     [Claude Code / Implementer]
                                                  │
                                                  ▼ (يكتب الحل في commit/inbox/)
                                     [push-commit.sh --pr <task_id>]
                                                  │
                                                  ▼
                                     [GitHub Branch: ai/fix-*]
                                                  │ (auto-pr.yml Actions)
                                                  ▼
                                     [Pull Request مفتوح تلقائياً]
                                                  │
                                                  ▼ (get_pending_reviews / submit_review_note)
                                     [AI Studio / Reviewer]
                                                  │
                                                  ▼ (Merge إلى main)
                                     [اكتملت الدورة بنجاح]
```

---

## 🛠️ أدوات إدارة المنظومة (Terminal Commands)

| الأمر | الوظيفة |
|---|---|
| `bash scripts/pipeline-status.sh` | عرض لوحة تحكم فورية لحالة المنظومة والمهام والخدمة |
| `bash scripts/pipeline-status.sh --watch` | مراقبة حية ومستمرة لكل التحديثات في الطرفية |
| `bash scripts/push-commit.sh` | معالجة فورية لكافة الملفات الموجودة في `commit/` ورفعها |
| `bash scripts/push-commit.sh --pr <task_id>` | رفع التعديلات في فرع `ai/fix-*` وفتح PR تلقائي |
| `bash scripts/push-commit.sh --watch` | تشغيل المراقبة التلقائية في الواجهة الأمامية |
| `systemctl --user status root-planner-watcher` | فحص خدمة الخلفية (Systemd Daemon) |
| `systemctl --user restart root-planner-watcher` | إعادة تشغيل خدمة المراقبة التلقائية |

---

## 🔑 الاستقلالية عن الحسابات (Account-Agnostic Setup)

المنظومة مصممة لتعمل بسلاسة حتى لو قمت بتغيير حساباتك أو أجهزة العمل:
- **هوية الوكيل** تُحدد بالدور والاتصال بالمستودع وليس بـ API Key معين.
- الـ MCP Server المحلي (`scripts/pipeline-mcp-server.mjs`) يوفر طبقة تجريد (Abstraction Layer) تسمح لأي عميل بالاستفسار وتنفيذ المهام.
- عند تبديل حساب GitHub أو الـ PAT، فقط قم بتحديث المتغير `GITHUB_PERSONAL_ACCESS_TOKEN` وأعد تشغيل الخادم/التطبيق، وسيقوم الوكيل بالتعرف على مهامه ومتابعة العمل من حيث توقف.

---

## 📂 هيكل التوثيق والمهام

- `.github/AGENT_ROLES.md`: الميثاق الرسمي للأدوار الثلاثة وتفاصيل كل دور.
- `commit/INBOX_GUIDE.md`: دليل توجيه الملفات للمطوّرين والوكلاء داخل مجلد `commit/`.
- `docs/pipeline/tasks/`: المستودع السحابي للمهام الموثقة والحية.
- `docs/pipeline/reviews/`: المستودع السحابي لملاحظات وتقييمات المراجعة.
