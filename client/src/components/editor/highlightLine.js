import { StateField, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export function highlightLine(lineNumber) {
    const deco = Decoration.line({
        attributes: { class: "highlighted-line" }
    });

    return StateField.define({
        create() {
            return Decoration.none;
        },
        update(decorations, tr) {
            const builder = new RangeSetBuilder();
            const doc = tr.state.doc;

            if (lineNumber >= 1 && lineNumber <= doc.lines) {
                const line = doc.line(lineNumber);
                builder.add(line.from, line.from, deco);
            }
            return builder.finish();
        },
        provide: f => EditorView.decorations.from(f)
    });
}
