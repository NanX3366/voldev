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

/**
 * 点标题栏 = 选中这个 atom 节点（等同于点块的外边框）。
 * atom 节点被选中时 NodeViewWrapper 会收到 selected=true，操作按钮才出现。
 */
function selectNode() {
  const pos = props.getPos();
  if (typeof pos !== "number") {
    return;
  }
  props.editor.chain().setNodeSelection(pos).run();
}

/** 在 at 位置插入一个空段落，并把光标移进去。 */
function insertParagraphAt(at: number) {
  props.editor
    .chain()
    .insertContentAt(at, { type: "paragraph" })
    .focus(at + 1)
    .run();
}

/**
 * 在组件下方插入一个空段落并把光标移进去，方便接着写正文。
 *
 * 看起来只是「在 next 位置插一个段落」，但组件外面常常还套着一层容器节点
 * （例如「限制内容阅读」这类自定义块），这里有个坑：
 *
 * 容器如果**已经装满**了子块（只允许套一个块的那种容器最常见），在容器末尾插
 * 一个新段落会违反容器自身的内容模型，ProseMirror 的内容适配（Fitter）就会把
 * 这个段落「抬」到容器外面去 —— 表现就是新行跑到了容器下方，而不是组件正下方、
 * 容器里面。
 *
 * 所以这里按容器能不能接住分三种情况：
 * ① 容器还能再接一个块：就近插在组件后面（多数容器属于这种，行为与原先一致）；
 * ② 容器已满：在容器后面再放一个同类型容器（属性一并复制），把空段落装进去，
 *    新行仍然落在限制区域内，不会漏到区域外面；
 * ③ 连 ② 都不可行（该容器类型不允许在同级再出现一次）：退回插在容器后面，
 *    至少保证光标有个可用的落点。
 */
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

  /** 判定某个位置能否再放下一个指定类型的块节点；内容模型异常时按「放不下」处理。 */
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

  // ① 组件所在容器还能再接一个块
  if (canInsertAt($after.parent, $after.index(), paragraphType)) {
    insertParagraphAt(after);
    return;
  }

  if ($after.depth > 0) {
    const container = $after.parent;
    const containerPos = $after.before($after.depth);
    const afterContainer = containerPos + container.nodeSize;
    const $afterContainer = doc.resolve(afterContainer);

    // ② 复制一层同样的容器，把空段落装进去
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
        // 容器起点 +1 进入容器、再 +1 进入段落的文字位置
        .focus(afterContainer + 2)
        .run();
      return;
    }

    // ③ 兜底
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

/* 选中态：与 Halo 编辑器其它块一致的主色描边 + 淡光晕 */
.volcano-block--selected {
  border-color: #4ccba0;
  box-shadow: 0 0 0 3px rgba(76, 203, 160, 0.16);
}

.volcano-block__bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  /* 右侧固定留出两个 28px 图标按钮的位置，选中时按钮浮上来不挤压、不遮挡文字 */
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
