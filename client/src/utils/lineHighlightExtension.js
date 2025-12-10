// utils/lineHighlightExtension.js
import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { RangeSet } from '@codemirror/state';

// Effect to update highlighted lines
export const setHighlightedLines = StateEffect.define();

// Create the line highlight decoration
const lineHighlightMark = Decoration.line({
  attributes: { 
    class: 'cm-highlighted-line',
    style: 'background: rgba(255, 255, 0, 0.2); border-left: 3px solid #f59e0b;'
  }
});

// State field to manage highlighted lines - THIS IS WHAT YOU EXPORT
export const lineHighlightExtension = StateField.define({
  create() {
    return Decoration.none;
  },
  update(lines, tr) {
    lines = lines.map(tr.changes);
    
    for (let effect of tr.effects) {
      if (effect.is(setHighlightedLines)) {
        const newLines = effect.value;
        console.log('🔄 Updating highlighted lines:', newLines);
        
        if (newLines.length === 0) {
          lines = Decoration.none;
        } else {
          let builders = [];
          newLines.forEach(lineNum => {
            if (lineNum > 0) {
              const line = tr.state.doc.line(lineNum);
              if (line) {
                builders.push(lineHighlightMark.range(line.from));
              }
            }
          });
          lines = RangeSet.of(builders, true);
        }
      }
    }
    
    return lines;
  },
  provide: f => EditorView.decorations.from(f)
});