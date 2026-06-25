'use strict';

// Плагин-наложение Zen Mode.
// 1) Obsidian автоматически подключает styles.css этого плагина поверх
//    текущей темы (Cupertino), пока плагин включён. При выключении CSS снимается.
// 2) Регистрирует команды toggle-heading-1..6: ведут себя как Cmd+B (bold) —
//    нажал раз → ставит заголовок нужного уровня, нажал ещё раз на том же
//    уровне → снимает заголовок (обычный текст). Работает и для выделения
//    из нескольких строк.
// Сборка/транспиляция не нужна: Obsidian грузит main.js как есть.
const { Plugin } = require('obsidian');

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
  }

  onunload() {}
};
