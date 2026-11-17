import {
  Node,
  ToolboxItem,
  VueNodeViewRenderer,
  type Editor,
  type Range,
} from "@halo-dev/richtext-editor";
import { markRaw } from "vue";
import IconCode from "~icons/ri/code-box-line";
import VolcanoView from "./VolcanoView.vue";
import { renderVolcano } from "./render";

function insertVolcano(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent([
      { type: "volcano-code", attrs: { content: "" } },
      { type: "paragraph" },
    ])
    .run();
}

export const ExtensionVolcano = Node.create({
  name: "volcano-code",
  group: "block",
  atom: true,
  code: true,
  defining: true,

  addAttributes() {
    return {
      content: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-content") ?? element.textContent ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-content": attributes.content ?? "",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "volcano-code" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    if (typeof document === "undefined") {
      return ["volcano-code", HTMLAttributes, node.attrs.content];
    }
    const element = document.createElement("volcano-code");
    Object.entries(HTMLAttributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, String(value));
      }
    });
    // 自定义标签默认是 inline，表格要按块级布局
    element.setAttribute("style", "display:block");
    element.innerHTML = renderVolcano(node.attrs.content ?? "");
    return element;
  },

  addNodeView() {
    return VueNodeViewRenderer(VolcanoView);
  },

  addOptions() {
    return {
      ...this.parent?.(),
      getToolboxItems({ editor }: { editor: Editor }) {
        return {
          priority: 100,
          component: markRaw(ToolboxItem),
          props: {
            editor,
            icon: markRaw(IconCode),
            title: "火山代码",
            description: "插入火山视窗文本格式代码块",
            action: () => insertVolcano(editor),
          },
        };
      },
      getCommandMenuItems() {
        return {
          priority: 100,
          icon: markRaw(IconCode),
          title: "火山代码",
          keywords: ["volcano", "huoshan", "火山", "代码"],
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            editor.chain().focus().deleteRange(range).run();
            insertVolcano(editor);
          },
        };
      },
    };
  },
});
