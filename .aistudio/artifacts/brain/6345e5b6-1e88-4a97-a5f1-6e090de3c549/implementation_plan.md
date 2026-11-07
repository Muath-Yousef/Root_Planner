# خطة ربط التطبيق بـ MCP و REST APIs و Gemini AI

تهدف هذه الخطة إلى تزويد استوديو طوبولوجيا Root Planner بحزمة تكامل متكاملة تغطي بروتوكول سياق النموذج (Model Context Protocol - MCP)، وواجهات البرمجة الخلفية REST API، وذكاء Gemini الاصطناعي لتوليد المخططات، مع دعم الوصول المحلي والشبكي (Remote over HTTP/SSE).

---

## 1. البنية المعمارية الموحدة (Full-Stack Express + Vite)

### الهدف:
تحويل بيئة التشغيل إلى تطبيق متكامل (Full-Stack) يشغل خادم `server.ts` موحد على المنفذ `3000`:
- تشغيل Express في الواجهة الخلفية مع ربط `vite.middlewares` أثناء وضع التطوير.
- خدمة واجهات الـ REST API تحت مسار `/api/*`.
- توفير نقطة نهاية MCP SSE تحت مسار `/sse` و `/messages`.
- الحفاظ على عمل الواجهة الأمامية React SPA بكامل مزاياها وأدائها.

---

## 2. محاور التكامل بالتفصيل

### المحور الأول: خادم وأدوات MCP (محلي وعن بُعد)
1. **دعم النقل المزدوج (Dual-Transport)**:
   - **Local Stdio Transport**: الاستفادة من `scripts/pipeline-mcp-server.mjs` لربطه بـ Claude Desktop، و Cursor، و Windsurf.
   - **Remote HTTP SSE Transport**: إضافة نقطة نهاية `/sse` ونقطة `/messages` في Express عبر حزمة `@modelcontextprotocol/sdk`، لتمكين أي عميل خارجي من الاتصال بالخادم عبر الشبكة.
2. **تجهيز ملفات الإعداد الجاهزة**:
   - توفير ملف تكوين جاهز للنسخ لكل من:
     - Claude Desktop (`claude_desktop_config.json`)
     - Cursor (`.cursor/mcp.json`)
     - Windsurf / Roo Code / Cline
3. **لوحة استكشاف وتشغيل MCP داخل التطبيق (In-App MCP Explorer)**:
   - نافذة تفاعلية (Modal/Drawer) في الاستوديو تسمح للمستخدم بتصفح جميع أدوات خط الإنتاج المتوفرة (`get_my_role`، `list_pending_tasks`، `get_pipeline_status`، إلخ) وتشغيلها مباشرة ورؤية النتائج فوراً.

---

### المحور الثاني: واجهات برمجة التطبيقات الخلفية (REST API)
توفير مسارات موثقة ومحمية لإدارة وتحليل المنظمات الرقمية برمجياً:
1. `GET /api/health`: فحص حالة السيرفر وخط الإنتاج.
2. `GET /api/projects` و `POST /api/projects`: حفظ وقراءة المشاريع.
3. `POST /api/topology/validate`: إرسال مخطط طوبولوجيا (Nodes & Edges) والتحقق من سلامته عبر محركات الفحص (Quality Gates, SSRF, Budget, Permission, Cabling) وإرجاع تقرير بالمشاكل.
4. `POST /api/topology/export`: توليد حزمة ZIP البرمجية المتوافقة مع المرجع الرئيسي وتحميلها برمجياً.
5. `GET /api/pipeline/status`: استعلام عن حالة خط الإنتاج وسجل المهام والمراجعات النشطة.

---

### المحور الثالث: تكامل الذكاء الاصطناعي (Gemini AI API)
1. **الخادم الخلفي للذكاء الاصطناعي**:
   - تثبيت حزمة `@google/genai`.
   - إنشاء مسار آمن `/api/ai/generate-topology` يستقبل طلباً باللغة الطبيعية (عربي أو إنجليزي).
   - استخدام نموذج `gemini-3.8-flash` لتحليل المتطلبات وتوليد بنية العقد (Nodes) والروابط (Edges) والعقود المعتمدة المتوافقة مع المرجع.
2. **واجهة الاستوديو (AI Architect Modal)**:
   - إضافة زر "المصمم الذكي (AI Architect)" في شريط التحكم العلوي أو القائمة.
   - نافذة لإدخال الوصف (مثال: *"أنشئ شركة استشارات مالية تضم موظف تدقيق، موظف تحليل بيانات، وموظف تقارير"*).
   - زر لتطبيق المخطط المقترح على مساحة العمل مباشرة مع إمكانية التراجع والتعديل.

---

## 3. خطوات التنفيذ والتحقق

1. **الاعتماديات**:
   - تثبيت `express` و `@types/express` و `tsx` و `@google/genai` دفعة واحدة عبر `install_applet_package`.
2. **تحديث السيرفر**:
   - إنشاء `server.ts` وتضمين مسارات الـ REST API ومسار SSE لبروتوكول MCP وخاصية دمج Vite.
   - تحديث نصوص التشغيل في `package.json` (`"dev": "tsx server.ts"` و `"start": "node server.ts"`).
3. **تطوير ميزات الواجهة الأمامية**:
   - إضافة مكون `McpExplorerModal` ومكون `AiArchitectModal`.
   - ربط الأزرار في شريط التحكم والقوائم.
4. **التوثيق وملفات الإعداد**:
   - إنشاء دليل `docs/INTEGRATION_GUIDE.md` يوضح خطوات ربط Claude Desktop و Cursor و cURL و Python بالـ API و MCP.
5. **التحقق والاختبار**:
   - تشغيل `compile_applet` و `lint_applet` للتأكد من خلو المشروع من أخطاء الـ TypeScript.
   - تشغيل `npm test` للتأكد من استمرار نجاح كافة الاختبارات الـ 191 السابقة.
