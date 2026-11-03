import fs from 'node:fs';
import path from 'node:path';

const refPath = path.resolve('MASTER_REFERENCE_v1.1_fea52b40.md');
if (!fs.existsSync(refPath)) {
  console.error('Master reference not found at:', refPath);
  process.exit(1);
}

const content = fs.readFileSync(refPath, 'utf8');
const lines = content.split('\n');

const index = {};
let currentRef = null;
let currentTitle = '';
let currentSnippet = [];

function flush() {
  if (currentRef && currentTitle) {
    const snippetText = currentSnippet
      .join(' ')
      .replace(/[*#`_\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);

    index[currentRef] = {
      ref: currentRef,
      title: currentTitle,
      snippet: snippetText + (snippetText.length >= 400 ? '…' : '')
    };
  }
  currentSnippet = [];
}

const headingRegex = /^(?:#{2,4})\s+(?:§\s*([0-9]+(?:\.[0-9]+)*)|([0-9]+(?:\.[0-9]+)+))\s*[—–-]?\s*(.+)$/;

for (const line of lines) {
  const match = line.match(headingRegex);
  if (match) {
    flush();
    const sectionNum = match[1] || match[2];
    currentRef = `§${sectionNum}`;
    currentTitle = match[3].trim();
  } else if (currentRef) {
    if (line.startsWith('#')) {
      // Another heading that didn't match the regex
      flush();
      currentRef = null;
    } else if (line.trim().length > 0 && currentSnippet.length < 5) {
      currentSnippet.push(line.trim());
    }
  }
}
flush();

// Also add manual canonical keys for common section groupings if not already exact
const canonicalMap = {
  '§1.2.1': { ref: '§1.2.1', title: 'الهرم المؤسسي الكامل وسيادة المؤسس', snippet: 'الهرم التنظيمي يحدد مستويات القيادة: المؤسس البشري في القمة، يليه منسق الأقسام، ثم مديرو الأقسام، ثم الموظفون الرقميون.' },
  '§3.1.1': { ref: '§3.1.1', title: 'منسّق الأقسام (Departments Orchestrator)', snippet: 'المكون المركزي لتوجيه الأهداف وتفكيك المهام العابرة للأقسام وتفويضها إلى مديري الأقسام.' },
  '§3.1.2': { ref: '§3.1.2', title: 'مدير القسم (Department Manager)', snippet: 'المسؤول عن إدارة دورة حياة الموظفين داخل القسم وتنسيق تنفيذ المهام وحوكمة الميزانية المحلية.' },
  '§3.1.3': { ref: '§3.1.3', title: 'الحلقة التساعية لدورة حياة المهمة (9-Step Lifecycle Loop)', snippet: 'دورة تساعية الخطوات تضمن الاستلام، تفكيك الخطة، حجز الميزانية، التحقق من قواطع الطوارئ، استدعاء النماذج، التحقق من المخرجات، التصعيد، التحديث التفاؤلي، وتثبيت سلسلة التدقيق SHA-256.' },
  '§4.2.1': { ref: '§4.2.1', title: 'نموذج الصلاحيات وحوكمة الامتيازات (RBAC)', snippet: 'قواعد الصلاحيات المرجعية والمشتقة بأقل امتياز ممكن. تمنع الصلاحيات غير المصرح بها وتعزل الموظفين.' },
  '§5.2.2': { ref: '§5.2.2', title: 'طبقات السياق الست لإدارة الذاكرة (Context Layers)', snippet: 'ترتيب ثابت لطبقات السياق: الهوية، قيود السياسات، الهدف ومعايير النجاح، الأدلة الموثوقة، حالة العمل الراهنة، والسوابق التاريخية.' },
  '§5.3.1': { ref: '§5.3.1', title: 'محرك الذاكرة رباعية المستويات (L1-L4 Memory Tiers)', snippet: 'تصنيف الذاكرة: L1 سياق تشغيلي سريع، L2 ذاكرة عمل القسم، L3 ذاكرة دلالية للسياسات، L4 أرشيف التخزين البارد غير القابل للتعديل.' },
  '§5.4.3': { ref: '§5.4.3', title: 'المصادر المعتمدة والشبكات الخارجية (Approved Sources)', snippet: 'عزل الشبكات والتحقق من مصادر البيانات المعتمدة لمنع استخراج الأسرار أو هجمات SSRF.' },
  '§6.3.2': { ref: '§6.3.2', title: 'تشريح الموظفين الرقميين والأدوار الثلاثة عشر', snippet: 'تعريفات الأدوار الـ 13 ومواصفاتها المعمارية: المهام، الصلاحيات، الحراس، والمنافذ المعتمدة.' }
};

for (const [k, v] of Object.entries(canonicalMap)) {
  if (!index[k]) {
    index[k] = v;
  }
}

const outDir = path.resolve('src/registry');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const targetFile = path.join(outDir, 'referenceIndex.generated.json');
fs.writeFileSync(targetFile, JSON.stringify(index, null, 2), 'utf8');
console.log(`Generated reference index with ${Object.keys(index).length} sections at ${targetFile}`);
