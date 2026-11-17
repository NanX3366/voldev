<script lang="ts" setup>
import { VButton, vTooltip } from "@halo-dev/components";
import { NodeViewWrapper, nodeViewProps } from "@halo-dev/richtext-editor";
import { onBeforeUnmount, ref, watch } from "vue";
import IconAddLine from "~icons/ri/add-line";
import IconDeleteBin from "~icons/ri/delete-bin-6-line";

const props = defineProps(nodeViewProps);

const draft = ref<string>((props.node.attrs.content as string) ?? "");
let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.node.attrs.content as string,
  (value) => {
    if ((value ?? "") !== draft.value) {
      draft.value = value ?? "";
    }
  },
);

function onInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  draft.value = value;
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => props.updateAttributes({ content: value }), 300);
}

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer);
  }
});

function selectNode() {
  const pos = props.getPos();
  if (typeof pos !== "number") {
    return;
  }
  props.editor.chain().setNodeSelection(pos).run();
}

function insertParagraphAt(at: number) {
  props.editor
    .chain()
    .insertContentAt(at, { type: "paragraph" })
    .focus(at + 1)
    .run();
}

function insertParagraphBelow() {
  const pos = props.getPos();
  if (typeof pos !== "number") {
    return;
  }
  const { doc, schema } = props.editor.state;
  const paragraphType = schema.nodes.paragraph;
  const node = doc.nodeAt(pos);
  if (!paragraphType || !node) {
    return;
  }

  const canInsertAt = (
    parent: typeof doc,
    index: number,
    type: NonNullable<typeof paragraphType>,
  ) => {
    try {
      return parent.canReplaceWith(index, index, type);
    } catch {
      return false;
    }
  };

  const after = pos + node.nodeSize;
  const $after = doc.resolve(after);

  if (canInsertAt($after.parent, $after.index(), paragraphType)) {
    insertParagraphAt(after);
    return;
  }

  if ($after.depth > 0) {
    const container = $after.parent;
    const containerPos = $after.before($after.depth);
    const afterContainer = containerPos + container.nodeSize;
    const $afterContainer = doc.resolve(afterContainer);

    const mockContainer = () => {
      try {
        return container.type.create(container.attrs, [paragraphType.create()]);
      } catch {
        return null;
      }
    };
    const wrapper = mockContainer();
    if (
      wrapper &&
      canInsertAt($afterContainer.parent, $afterContainer.index(), wrapper.type)
    ) {
      props.editor
        .chain()
        .insertContentAt(afterContainer, wrapper.toJSON())

        .focus(afterContainer + 2)
        .run();
      return;
    }

    insertParagraphAt(afterContainer);
    return;
  }

  insertParagraphAt(after);
}

function removeBlock() {
  props.deleteNode();
}
</script>

<template>
  <node-view-wrapper
    class="volcano-block"
    :class="{ 'volcano-block--selected': selected }"
  >
    <div
      class="volcano-block__bar"
      contenteditable="false"
      @mousedown.prevent="selectNode"
    >
      <span class="volcano-block__title">火山代码</span>
      <span class="volcano-block__tip"
        >粘贴「文本格式」代码，发布后按 IDE 表格样式展示</span
      >
      <div
        v-if="selected"
        class="volcano-block__actions"
        contenteditable="false"
        @mousedown.prevent.stop
      >
        <VButton
          v-tooltip="'在下方插入一行'"
          size="sm"
          ghost
          @click="insertParagraphBelow"
        >
          <template #icon><IconAddLine /></template>
        </VButton>
        <VButton
          v-tooltip="'删除此代码块'"
          size="sm"
          ghost
          @click="removeBlock"
        >
          <template #icon><IconDeleteBin /></template>
        </VButton>
      </div>
    </div>
    <textarea
      class="volcano-block__input"
      :value="draft"
      spellcheck="false"
      placeholder="在此粘贴火山视窗「文本格式」代码"
      @input="onInput"
      @mousedown.stop
    />
  </node-view-wrapper>
</template>

<style scoped>
.volcano-block {
  position: relative;
  margin: 1em 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.volcano-block--selected {
  border-color: #4ccba0;
  box-shadow: 0 0 0 3px rgba(76, 203, 160, 0.16);
}

.volcano-block__bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;

  min-height: 34px;
  padding: 3px 96px 3px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  font-size: 13px;
  cursor: default;
  user-select: none;
}

.volcano-block__title {
  flex: 0 0 auto;
  font-weight: 500;
  color: #111827;
}

.volcano-block__tip {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.volcano-block__actions {
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 2px;
  transform: translateY(-50%);
}

.volcano-block__input {
  display: block;
  width: 100%;
  min-height: 420px;
  margin: 0;
  padding: 12px;
  border: 0;
  outline: none;
  resize: vertical;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: "Cascadia Mono", "Consolas", "Sarasa Mono SC", "Microsoft YaHei Mono", monospace;
  font-size: 13px;
  line-height: 1.65;
  tab-size: 4;
}

.volcano-block__input::placeholder {
  color: #6b7280;
}
</style>
