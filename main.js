'use strict';

// Плагин-наложение Zen Mode.
// 1) Obsidian автоматически подключает styles.css этого плагина поверх
//    текущей темы (Cupertino), пока плагин включён. При выключении CSS снимается.
// 2) Регистрирует команды toggle-heading-1..6: ведут себя как Cmd+B (bold) —
//    нажал раз → ставит заголовок нужного уровня, нажал ещё раз на том же
//    уровне → снимает заголовок (обычный текст). Работает и для выделения
//    из нескольких строк.
// 3) Добавляет ribbon-кнопку и команду reload-active-file: перечитывают
//    активный файл напрямую с диска, минуя кеш Obsidian (удобно после
//    внешних правок). Сохраняют курсор и прокрутку; несохранённые правки
//    отбрасываются.
// 4) Управляет заголовком окна. Obsidian по умолчанию пишет
//    «{файл} - {vault} - Obsidian vX.Y.Z». Electron зеркалит document.title в
//    нативное окно ОС, поэтому достаточно полностью перезаписать document.title
//    своим шаблоном (а не дописывать к стандартному) на тех же событиях, что
//    слушает Obsidian. В шаблоне нет слова «Obsidian» и версии — значит и в
//    шапке окна их не будет. При выключении плагина возвращаем исходный заголовок.
// Сборка/транспиляция не нужна: Obsidian грузит main.js как есть.
const { Plugin, Notice, MarkdownView } = require('obsidian');

// Шаблон заголовка окна. Плейсхолдеры: {{filename}}, {{filepath}}, {{vault}}.
const WINDOW_TITLE_TEMPLATE = '{{filename}} — {{vault}}';

// Снять любой существующий заголовок со строки -> вернуть «тело».
function headingBody(line) {
  return line.replace(/^\s*#{1,6}\s+/, '');
}

// Текущий уровень заголовка строки (0 — обычный текст).
function headingLevel(line) {
  const m = line.match(/^\s*(#{1,6})\s+/);
  return m ? m[1].length : 0;
}

// Тоггл заголовка уровня `level` по всем строкам выделения.
function toggleHeading(editor, level) {
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');

  // Если все затронутые строки уже на этом уровне — снимаем, иначе ставим.
  let allMatch = true;
  for (let ln = from.line; ln <= to.line; ln++) {
    if (headingLevel(editor.getLine(ln)) !== level) { allMatch = false; break; }
  }
  const prefix = allMatch ? '' : '#'.repeat(level) + ' ';

  for (let ln = from.line; ln <= to.line; ln++) {
    const original = editor.getLine(ln);
    if (original.trim() === '') continue; // пустые строки не трогаем
    editor.setLine(ln, prefix + headingBody(original));
  }
}

module.exports = class ZenMode extends Plugin {
  onload() {
    for (let level = 1; level <= 6; level++) {
      this.addCommand({
        id: `toggle-heading-${level}`,
        name: `Toggle heading ${level}`,
        editorCallback: (editor) => toggleHeading(editor, level),
      });
    }

    // Кнопка на левой панели — перечитать активный файл с диска.
    this.addRibbonIcon('refresh-cw', 'Reload file from disk', () => {
      this.reloadActiveFile();
    });

    // Та же команда — для горячей клавиши (Cmd+R) и палитры команд.
    this.addCommand({
      id: 'reload-active-file',
      name: 'Reload current file from disk',
      callback: () => this.reloadActiveFile(),
    });

    this.setupWindowTitle();
  }

  // Собирает заголовок окна по WINDOW_TITLE_TEMPLATE из текущего файла и vault.
  buildWindowTitle() {
    const vault = this.app.vault.getName();
    const file = this.app.workspace.getActiveFile();
    const filename = file ? file.basename : '';
    const filepath = file ? file.path : '';
    const title = WINDOW_TITLE_TEMPLATE
      .replace(/\{\{filename\}\}/g, filename)
      .replace(/\{\{filepath\}\}/g, filepath)
      .replace(/\{\{vault\}\}/g, vault)
      // Если файл не открыт, шаблон начнётся с разделителя — срежем его.
      .replace(/^\s*[—–-]\s*/, '')
      .trim();
    return title || vault;
  }

  // Полностью перезаписывает document.title своим шаблоном на тех же событиях,
  // что и Obsidian. Electron зеркалит document.title в нативное окно ОС, так что
  // стандартный «… - Obsidian vX.Y.Z» больше не показывается.
  setupWindowTitle() {
    this.baseTitle = document.title; // вернём при выгрузке плагина

    const apply = () => { document.title = this.buildWindowTitle(); };

    this.registerEvent(this.app.workspace.on('file-open', apply));
    this.registerEvent(this.app.workspace.on('active-leaf-change', apply));
    this.registerEvent(this.app.workspace.on('layout-change', apply));
    this.registerEvent(this.app.vault.on('rename', apply));
    this.registerEvent(this.app.vault.on('delete', apply));
    this.registerEvent(this.app.metadataCache.on('changed', apply));

    apply();
  }

  // Перечитывает активный файл напрямую с диска, минуя кеш Obsidian.
  // Сохраняет позицию курсора и прокрутку; несохранённые правки отбрасываются.
  async reloadActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Reload file: no active file');
      return;
    }
    try {
      const diskContent = await this.app.vault.adapter.read(file.path);
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view && view.editor && view.file === file) {
        const editor = view.editor;
        if (editor.getValue() === diskContent) {
          new Notice('Reload file: already up to date');
          return;
        }
        const cursor = editor.getCursor();
        const scroll = editor.getScrollInfo();
        editor.setValue(diskContent);
        editor.setCursor(cursor);
        editor.scrollTo(scroll.left, scroll.top);
      } else {
        // Не markdown-редактор (PDF/изображение/превью) — обновляем через vault.
        await this.app.vault.modify(file, diskContent);
      }
      new Notice('Reloaded ' + file.name + ' from disk');
    } catch (e) {
      new Notice('Reload file: error — ' + e.message);
      console.error('[obsidian-zen] reload', e);
    }
  }

  onunload() {
    // Вернуть стандартный заголовок Obsidian.
    if (this.baseTitle != null) document.title = this.baseTitle;
  }
};
