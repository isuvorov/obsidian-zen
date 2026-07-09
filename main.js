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
// 5) Свайп двумя пальцами по трекпаду открывает/закрывает левый сайдбар —
//    как на iPad / в Things 3. Свайп вправо раскрывает, влево сворачивает.
//    На macOS жест приходит как wheel с доминирующим deltaX. Слушаем пассивно,
//    preventDefault не зовём — обычный горизонтальный скролл не ломается.
// Сборка/транспиляция не нужна: Obsidian грузит main.js как есть.
const { Plugin, Notice, MarkdownView, FuzzySuggestModal, Platform } = require('obsidian');

// Шаблон заголовка окна. Плейсхолдеры: {{filename}}, {{filepath}}, {{vault}}.
const WINDOW_TITLE_TEMPLATE = '{{filename}} — {{vault}}';

// --- Свайп для левого сайдбара ---
const SWIPE_THRESHOLD = 60;     // суммарный горизонтальный путь (px) для срабатывания
const SWIPE_RESET_MS = 300;     // пауза, после которой накопление пути сбрасывается
const SWIPE_COOLDOWN_MS = 600;  // защита от повторного срабатывания за тот же жест
// Если направления ощущаются перевёрнутыми — поставь true.
const SWIPE_INVERT = false;

// Курсор над горизонтально прокручиваемым блоком (таблица, длинный код)?
// Там deltaX — это обычный скролл, а не жест: сайдбар трогать не нужно.
function isInHorizontalScroller(node) {
  for (let el = node; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

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

// Папка глобального конфига Obsidian, где лежит obsidian.json со списком vaults.
function obsidianConfigDir() {
  const os = require('os');
  const path = require('path');
  const home = os.homedir();
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'obsidian');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'obsidian');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'obsidian');
}

// Fuzzy-палитра выбора vault — та же UI-основа, что у quick switcher.
// Открывается внутри окна (в отличие от стартового окна команды app:open-vault).
class VaultSwitcherModal extends FuzzySuggestModal {
  constructor(app, vaults, onPick) {
    super(app);
    this.vaults = vaults;
    this.onPick = onPick;
    this.setPlaceholder('Open another vault…');
  }
  getItems() {
    return this.vaults;
  }
  getItemText(v) {
    return v.name;
  }
  onChooseItem(v) {
    this.onPick(v);
  }
}

module.exports = class ZenMode extends Plugin {
  async onload() {
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

    // Открыть другой vault через fuzzy-палитру внутри окна (а не стартовое окно).
    this.addCommand({
      id: 'open-vault',
      name: 'Open another vault',
      callback: () => this.openVaultPalette(),
    });

    // Широкая вёрстка: тоггл body-класса zen-wide. В этом режиме CSS снимает
    // ограничение ширины колонки (Obsidian «Readable line length»), чтобы
    // широкие таблицы и текст занимали всю доступную ширину окна.
    this.addCommand({
      id: 'toggle-wide-mode',
      name: 'Toggle wide layout',
      callback: () => this.toggleWideMode(),
    });

    // Та же команда на кнопке в левой ленте.
    this.addRibbonIcon('unfold-horizontal', 'Toggle wide layout', () => {
      this.toggleWideMode();
    });

    // Восстановить сохранённое состояние широкой вёрстки.
    const data = await this.loadData();
    this.applyWideMode(!!(data && data.wide));

    this.setupWindowTitle();
    this.setupSidebarSwipe();
  }

  // Вешает/снимает класс zen-wide на <body> — остальное делает CSS.
  applyWideMode(on) {
    this.wide = on;
    document.body.classList.toggle('zen-wide', on);
  }

  // Переключает широкую вёрстку и запоминает выбор между перезапусками.
  async toggleWideMode() {
    this.applyWideMode(!this.wide);
    await this.saveData({ wide: this.wide });
    new Notice(this.wide ? 'Wide layout: on' : 'Wide layout: off');
  }

  // Горизонтальный свайп двумя пальцами по трекпаду тогглит левый сайдбар.
  // На macOS такой жест прилетает как серия wheel-событий с доминирующим deltaX.
  // Накапливаем путь, при превышении порога раскрываем/сворачиваем сайдбар.
  setupSidebarSwipe() {
    let accX = 0;        // накопленный горизонтальный путь текущего жеста
    let lastTs = 0;      // время последнего wheel-события
    let cooldownUntil = 0;

    this.registerDomEvent(window, 'wheel', (e) => {
      const now = Date.now();
      if (now < cooldownUntil) return;

      // Интересует только горизонтально-доминирующее движение (жест, не скролл).
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) { accX = 0; return; }

      // Над таблицей/кодом deltaX — это скролл содержимого, а не жест сайдбара.
      if (isInHorizontalScroller(e.target)) { accX = 0; return; }

      if (now - lastTs > SWIPE_RESET_MS) accX = 0; // новый жест — копим заново
      lastTs = now;
      accX += e.deltaX;

      if (Math.abs(accX) < SWIPE_THRESHOLD) return;

      const left = this.app.workspace.leftSplit;
      if (!left) return;

      // macOS natural scroll: свайп пальцами вправо → deltaX < 0 → раскрыть.
      const expand = SWIPE_INVERT ? accX > 0 : accX < 0;
      if (expand) left.expand(); else left.collapse();

      accX = 0;
      cooldownUntil = now + SWIPE_COOLDOWN_MS;
    }, { passive: true });
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

  // Абсолютный путь текущего vault (для отсева его из списка).
  currentVaultPath() {
    const a = this.app.vault.adapter;
    return (a.getBasePath && a.getBasePath()) || a.basePath || '';
  }

  // Читает список vaults из глобального obsidian.json, кроме текущего.
  listVaults() {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(obsidianConfigDir(), 'obsidian.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cur = this.currentVaultPath();
    return Object.entries(data.vaults || {})
      .map(([id, v]) => ({ id, path: v.path, name: path.basename(v.path) }))
      .filter((v) => v.path && v.path !== cur)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Открывает палитру выбора vault; по выбору переключается на него.
  openVaultPalette() {
    if (!Platform.isDesktopApp) {
      new Notice('Open another vault: desktop only');
      return;
    }
    let vaults;
    try {
      vaults = this.listVaults();
    } catch (e) {
      new Notice('Open another vault: cannot read vault list — ' + e.message);
      return;
    }
    if (!vaults.length) {
      new Notice('No other vaults found');
      return;
    }
    new VaultSwitcherModal(this.app, vaults, (v) => this.openVault(v)).open();
  }

  // Переключается на vault по абсолютному пути тем же IPC, что и сам Obsidian.
  openVault(v) {
    try {
      const ok = window.electron.ipcRenderer.sendSync('vault-open', v.path, false);
      if (ok !== true) new Notice('Failed to open vault: ' + (typeof ok === 'string' ? ok : v.name));
    } catch (e) {
      new Notice('Open vault error: ' + e.message);
    }
  }

  onunload() {
    // Вернуть стандартный заголовок Obsidian.
    if (this.baseTitle != null) document.title = this.baseTitle;
    // Снять класс широкой вёрстки (CSS плагина всё равно снимается сам).
    document.body.classList.remove('zen-wide');
  }
};
