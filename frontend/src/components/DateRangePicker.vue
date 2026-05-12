<template>
  <el-date-picker
    v-model="draft"
    type="datetimerange"
    range-separator="→"
    start-placeholder="开始时间"
    end-placeholder="结束时间"
    format="YYYY-MM-DD HH:mm"
    value-format="x"
    :popper-class="popperClass"
    :shortcuts="shortcuts"
    :show-confirm="true"
    :clearable="false"
    :default-time="defaultTime"
    style="width: 360px"
    @visible-change="onVisibleChange"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: [Date, Date] | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [[Date, Date]];
  'visible-change': [boolean];
}>();

type DateRange = [Date, Date];
type InnerValue = number | string;
type InnerRange = [InnerValue, InnerValue];
type PickerDate = { toDate: () => Date };
type ShortcutContext = {
  emit: (event: 'pick', value: [PickerDate, PickerDate], visible?: boolean) => void;
};

const popperClass = `date-range-picker-popper-${Math.random().toString(36).slice(2)}`;
const draft = ref<InnerRange | null>(toInner(props.modelValue));
const pickerOpen = ref(false);
let closeTimer: number | undefined;
let commitTimer: number | undefined;
let commitRequested = false;

watch(() => props.modelValue, (value) => {
  if (!pickerOpen.value) draft.value = toInner(value);
});

function toInner(value: DateRange | null): InnerRange | null {
  if (!value) return null;
  return [value[0].getTime(), value[1].getTime()];
}

function toDateRange(value: InnerRange): DateRange {
  return [new Date(Number(value[0])), new Date(Number(value[1]))];
}

function syncDraft() {
  draft.value = toInner(props.modelValue);
}

function isSameRange(a: DateRange | null, b: DateRange): boolean {
  return Boolean(a && a[0].getTime() === b[0].getTime() && a[1].getTime() === b[1].getTime());
}

function commitDraft() {
  commitTimer = undefined;
  commitRequested = false;
  if (!draft.value) {
    syncDraft();
    return;
  }

  const next = toDateRange(draft.value);
  if (!isSameRange(props.modelValue, next)) emit('update:modelValue', next);
}

function onVisibleChange(visible: boolean) {
  pickerOpen.value = visible;
  emit('visible-change', visible);
  if (closeTimer) window.clearTimeout(closeTimer);

  if (visible) {
    commitRequested = false;
    syncDraft();
    return;
  }

  if (commitRequested) return;
  closeTimer = window.setTimeout(syncDraft, 0);
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const confirmButton = target.closest('button.el-picker-panel__link-btn');
  const footer = confirmButton?.closest('.el-picker-panel__footer');
  if (!confirmButton || !footer || !confirmButton.closest(`.${popperClass}`)) return;
  if ((confirmButton as HTMLButtonElement).disabled || confirmButton.classList.contains('is-disabled')) return;

  const buttons = Array.from(footer.querySelectorAll('button.el-picker-panel__link-btn'));
  if (confirmButton !== buttons[buttons.length - 1]) return;

  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
  }
  if (commitTimer) window.clearTimeout(commitTimer);
  commitRequested = true;
  commitTimer = window.setTimeout(commitDraft, 0);
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true);
  if (closeTimer) window.clearTimeout(closeTimer);
  if (commitTimer) window.clearTimeout(commitTimer);
});

function keepOpenShortcut(value: () => DateRange) {
  return ({ emit }: ShortcutContext) => {
    const [start, end] = value();
    emit(
      'pick',
      [
        { toDate: () => new Date(start.getTime()) },
        { toDate: () => new Date(end.getTime()) },
      ],
      true
    );
  };
}

// 起始用 00:00:00,结束用 23:59:59
const defaultTime: [Date, Date] = [
  new Date(2000, 0, 1, 0, 0, 0),
  new Date(2000, 0, 1, 23, 59, 59),
];

// shortcuts 点击时计算一次,不会自动滚动
const shortcuts = [
  {
    text: '最近 1 小时',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date(end.getTime() - 3600 * 1000);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '最近 6 小时',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date(end.getTime() - 6 * 3600 * 1000);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '最近 24 小时',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 3600 * 1000);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '最近 7 天',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '最近 30 天',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '今天',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '昨天',
    onClick: keepOpenShortcut(() => {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return [start, end] as [Date, Date];
    }),
  },
  {
    text: '本月',
    onClick: keepOpenShortcut(() => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return [start, end] as [Date, Date];
    }),
  },
];
</script>
