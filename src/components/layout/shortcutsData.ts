export interface ShortcutDefinition {
  id: string;
  keyLabel: string;
  descriptionKey: string;
  descriptionEn: string;
  descriptionAr: string;
  category: 'edit' | 'canvas' | 'navigation' | 'simulation';
}

export const SHORTCUTS_TABLE: readonly ShortcutDefinition[] = [
  {
    id: 'palette',
    keyLabel: '⌘K / Ctrl+K',
    descriptionKey: 'palette.cmd.open',
    descriptionEn: 'Open command palette',
    descriptionAr: 'فتح لوحة الأوامر السريعة',
    category: 'navigation',
  },
  {
    id: 'help',
    keyLabel: '?',
    descriptionKey: 'top.help',
    descriptionEn: 'Open help & shortcuts cheat-sheet',
    descriptionAr: 'فتح دليل المساعدة والاختصارات',
    category: 'navigation',
  },
  {
    id: 'undo',
    keyLabel: '⌘Z / Ctrl+Z',
    descriptionKey: 'top.undo',
    descriptionEn: 'Undo last action',
    descriptionAr: 'تراجع عن الإجراء الأخير',
    category: 'edit',
  },
  {
    id: 'redo',
    keyLabel: '⌘⇧Z / Ctrl+Y',
    descriptionKey: 'top.redo',
    descriptionEn: 'Redo undone action',
    descriptionAr: 'إعادة تطبيق الإجراء',
    category: 'edit',
  },
  {
    id: 'copy',
    keyLabel: '⌘C / Ctrl+C',
    descriptionKey: 'palette.cmd.copy',
    descriptionEn: 'Copy selected components',
    descriptionAr: 'نسخ المكوّنات المحددة',
    category: 'edit',
  },
  {
    id: 'paste',
    keyLabel: '⌘V / Ctrl+V',
    descriptionKey: 'palette.cmd.paste',
    descriptionEn: 'Paste components from clipboard',
    descriptionAr: 'لصق المكوّنات من الحافظة',
    category: 'edit',
  },
  {
    id: 'duplicate',
    keyLabel: '⌘D / Ctrl+D',
    descriptionKey: 'palette.cmd.duplicate',
    descriptionEn: 'Duplicate selected components',
    descriptionAr: 'مضاعفة المكوّنات المحددة',
    category: 'edit',
  },
  {
    id: 'select_all',
    keyLabel: '⌘A / Ctrl+A',
    descriptionKey: 'palette.cmd.select_all',
    descriptionEn: 'Select all nodes on canvas',
    descriptionAr: 'تحديد كافة العقد في اللوحة',
    category: 'edit',
  },
  {
    id: 'delete',
    keyLabel: 'Del / Backspace',
    descriptionKey: 'palette.cmd.delete',
    descriptionEn: 'Delete selected components',
    descriptionAr: 'حذف المكوّنات المحددة',
    category: 'edit',
  },
  {
    id: 'autolayout',
    keyLabel: '⌘L / Ctrl+L',
    descriptionKey: 'top.autolayout',
    descriptionEn: 'Auto layout topology diagram',
    descriptionAr: 'تنسيق مخطط الطوبولوجيا تلقائياً',
    category: 'canvas',
  },
  {
    id: 'sim_play',
    keyLabel: 'Space',
    descriptionKey: 'sim.play_pause',
    descriptionEn: 'Play / Pause 9-step simulation',
    descriptionAr: 'تشغيل / إيقاف محاكاة دورة الحياة',
    category: 'simulation',
  },
  {
    id: 'sim_step_back',
    keyLabel: '← Arrow Left',
    descriptionKey: 'sim.step_back',
    descriptionEn: 'Step back to previous simulation step',
    descriptionAr: 'خطوة للخلف في المحاكاة',
    category: 'simulation',
  },
  {
    id: 'sim_step_forward',
    keyLabel: '→ Arrow Right',
    descriptionKey: 'sim.step',
    descriptionEn: 'Step forward to next simulation step',
    descriptionAr: 'خطوة للأمام في المحاكاة',
    category: 'simulation',
  },
  {
    id: 'dismiss',
    keyLabel: 'Esc',
    descriptionKey: 'toast.dismiss',
    descriptionEn: 'Close open modal or cancel selection',
    descriptionAr: 'إغلاق النافذة النشطة أو إلغاء التحديد',
    category: 'navigation',
  },
] as const;
