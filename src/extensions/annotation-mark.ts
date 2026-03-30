import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface AnnotationMarkOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    annotationMark: {
      setAnnotationMark: (attributes: {
        id: string;
        number: string;
        annotationType: "word" | "sentence";
      }) => ReturnType;
      unsetAnnotationMark: () => ReturnType;
    };
  }
}

const AnnotationMark = Mark.create<AnnotationMarkOptions>({
  name: "annotationMark",

  excludes: "",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-annotation-id"),
        renderHTML: (attributes) => ({
          "data-annotation-id": attributes.id,
        }),
      },
      number: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-annotation-number"),
        renderHTML: (attributes) => ({
          "data-annotation-number": attributes.number,
        }),
      },
      annotationType: {
        default: "word",
        parseHTML: (element) => element.getAttribute("data-annotation-type"),
        renderHTML: (attributes) => ({
          "data-annotation-type": attributes.annotationType,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-annotation-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `annotation-mark annotation-mark--${HTMLAttributes["data-annotation-type"] || "word"}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setAnnotationMark:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetAnnotationMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    const markType = this.type;

    return [
      new Plugin({
        key: new PluginKey("annotationBadges"),
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];
            const markRanges = new Map<
              string,
              { from: number; to: number; number: string; annotationType: string }
            >();

            doc.descendants((node, pos) => {
              if (!node.isText) return;
              for (const mark of node.marks) {
                if (mark.type !== markType) continue;
                const id = mark.attrs.id as string;
                const existing = markRanges.get(id);
                if (existing) {
                  existing.from = Math.min(existing.from, pos);
                  existing.to = Math.max(existing.to, pos + node.nodeSize);
                } else {
                  markRanges.set(id, {
                    from: pos,
                    to: pos + node.nodeSize,
                    number: mark.attrs.number as string,
                    annotationType: mark.attrs.annotationType as string,
                  });
                }
              }
            });

            for (const [id, range] of markRanges) {
              const widget = Decoration.widget(
                range.to,
                () => {
                  const badge = document.createElement("sup");
                  badge.className = `annotation-badge annotation-badge--${range.annotationType}`;
                  badge.textContent = range.number;
                  badge.dataset.annotationId = id;
                  return badge;
                },
                { side: 1, stopEvent: () => true }
              );
              decorations.push(widget);
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export default AnnotationMark;
