const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const RATIOS = {
  "2:3": [1080, 1620],
  "3:4": [1080, 1440],
  "3:5": [1080, 1800],
  "4:5": [1080, 1350],
  "9:16": [1080, 1920],
};

const SETTINGS_STORAGE_KEY = "story-card-settings-v1";
const SETTINGS_DEFAULTS = Object.freeze({
  ratio: "3:4",
  width: 1080,
  height: 1440,
  fontFamily: "huninn",
  fontSize: 42,
  boldAll: false,
  padding: 96,
  bg: "#f7f3ea",
  dark: "#252525",
  light: "#a39e96",
  redactColor: "#252525",
  redactMode: "same",
});

const SAVED_CONTROL_IDS = [
  "width", "height", "fontFamily", "fontSize", "boldAll", "padding",
  "bg", "dark", "light", "redactColor",
];

const fonts = {
  huninn: { family: '"Huninn","PingFang TC","Noto Sans TC",sans-serif', load: "Huninn" },
  goround: { family: '"Chiron GoRound TC","PingFang TC","Noto Sans TC",sans-serif', load: "Chiron GoRound TC" },
  hachimaru: { family: '"Hachi Maru Pop","Huninn","PingFang TC",sans-serif', load: "Hachi Maru Pop", note: "少數繁體字會自動改用粉圓體補上。" },
  wenkai: { family: '"LXGW WenKai TC","Kaiti TC","DFKai-SB",serif', load: "LXGW WenKai TC" },
  iansui: { family: '"Iansui","LXGW WenKai TC","Kaiti TC",serif', load: "Iansui" },
  klee: { family: '"Klee One","LXGW WenKai TC","Kaiti TC",serif', load: "Klee One", note: "少數繁體字會自動改用霞鶩文楷補上。" },
  ming: { family: '"Noto Serif TC","PMingLiU","MingLiU",serif', load: "Noto Serif TC" },
  song: { family: '"Chiron Sung HK","Songti TC","Noto Serif TC",serif', load: "Chiron Sung HK" },
  fangsong: { family: '"FangSong","STFangsong","FangSong_GB2312","Noto Serif TC",serif', load: "Noto Serif TC", note: "會優先使用裝置內建仿宋；沒有時以繁體明體補上，避免缺字。" },
  sans: { family: '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif' },
  rounded: { family: '"Arial Rounded MT Bold","PingFang TC","Microsoft JhengHei",sans-serif' },
  mono: { family: '"Noto Sans Mono CJK TC","Microsoft JhengHei",monospace' },
};

const state = {
  mode: "text",
  ratio: "3:4",
  sourceCanvas: null,
  cuts: [],
  img: null,
  paragraphEnds: [],
  outputFiles: null,
  outputTimer: null,
  addingCut: false,
  removingCut: false,
  livePreview: false,
  renderTimer: null,
  renderKind: "visual",
  renderToken: 0,
};

const NO_START = "，。、；：！？）」』】》〉,.;:!?)]}…～%";
const NO_END = "「『（【《〈([{";
const REDACT_PALETTE = ["#252525", "#d47791", "#668eb5", "#7ca27c", "#9c7fc1", "#c79555", "#5f9e98", "#b56d64"];
const redactColors = {};
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" })
  : null;

function graphemes(text) {
  return segmenter ? [...segmenter.segment(text)].map((item) => item.segment) : [...text];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.remove("show"), 2200);
}

function safeStoredSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.debug("無法讀取本機設定", error);
    return null;
  }
}

function validColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function normalizeSettings(value = {}) {
  const ratio = value.ratio === "custom" || RATIOS[value.ratio] ? value.ratio : SETTINGS_DEFAULTS.ratio;
  return {
    ratio,
    width: clamp(Number(value.width ?? SETTINGS_DEFAULTS.width), 320, 2400),
    height: clamp(Number(value.height ?? SETTINGS_DEFAULTS.height), 400, 3200),
    fontFamily: Object.hasOwn(fonts, value.fontFamily) ? value.fontFamily : SETTINGS_DEFAULTS.fontFamily,
    fontSize: clamp(Number(value.fontSize ?? SETTINGS_DEFAULTS.fontSize), 18, 120),
    boldAll: typeof value.boldAll === "boolean" ? value.boldAll : SETTINGS_DEFAULTS.boldAll,
    padding: clamp(Number(value.padding ?? SETTINGS_DEFAULTS.padding), 32, 180),
    bg: validColor(value.bg, SETTINGS_DEFAULTS.bg),
    dark: validColor(value.dark, SETTINGS_DEFAULTS.dark),
    light: validColor(value.light, SETTINGS_DEFAULTS.light),
    redactColor: validColor(value.redactColor, SETTINGS_DEFAULTS.redactColor),
    redactMode: value.redactMode === "each" ? "each" : "same",
  };
}

function collectSettings() {
  return normalizeSettings({
    ratio: state.ratio,
    width: $("#width").value,
    height: $("#height").value,
    fontFamily: $("#fontFamily").value,
    fontSize: $("#fontSize").value,
    boldAll: $("#boldAll").checked,
    padding: $("#padding").value,
    bg: $("#bg").value,
    dark: $("#dark").value,
    light: $("#light").value,
    redactColor: $("#redactColor").value,
    redactMode: $('input[name="redactMode"]:checked')?.value,
  });
}

function saveSettings() {
  try {
    globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(collectSettings()));
  } catch (error) {
    console.debug("無法儲存本機設定", error);
  }
}

function applySettings(value) {
  const settings = normalizeSettings({ ...SETTINGS_DEFAULTS, ...value });
  $("#width").value = settings.width;
  $("#height").value = settings.height;
  $("#fontFamily").value = settings.fontFamily;
  $("#fontSize").value = settings.fontSize;
  $("#boldAll").checked = settings.boldAll;
  $("#padding").value = settings.padding;
  $("#bg").value = settings.bg;
  $("#dark").value = settings.dark;
  $("#light").value = settings.light;
  $("#redactColor").value = settings.redactColor;
  $$('input[name="redactMode"]').forEach((radio) => { radio.checked = radio.value === settings.redactMode; });
  selectRatio(settings.ratio);
  $("#paddingValue").textContent = `${settings.padding} px`;
  updateFontPreview();
  updateColorLabel("#bg", "#bgHex");
  updateColorLabel("#dark", "#darkHex");
  updateColorLabel("#light", "#lightHex");
  renderRedactList();
}

function resetSavedSettings() {
  try {
    globalThis.localStorage?.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.debug("無法清除本機設定", error);
  }
  applySettings(SETTINGS_DEFAULTS);
  scheduleLivePreview("layout", 80);
  toast("已恢復預設設定");
}

function updateCharacterCount() {
  const length = graphemes($("#textInput").value).length;
  $("#charCount").textContent = `${length.toLocaleString("zh-TW")} 字`;
}

function adjustEditorHeight(delta) {
  const editor = $("#textInput");
  const current = editor.getBoundingClientRect?.().height || Number.parseFloat(editor.style.height) || 310;
  const next = clamp(Math.round(current + delta), 280, 1000);
  editor.style.height = `${next}px`;
  toast(next === 280 ? "已縮至最小高度" : next === 1000 ? "已加至最大高度" : `文字框高度：${next} px`);
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  $$(".mode-tab").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  $("#textSection").classList.toggle("hidden", mode !== "text");
  $("#uploadSection").classList.toggle("hidden", mode === "text");
  $("#textSettings").classList.toggle("hidden", mode === "split");
  state.livePreview = false;
  clearPreview();
}

function setPreviewStatus(label, live = state.livePreview) {
  $("#previewState").textContent = label;
  $("#liveDot").classList.toggle("live", Boolean(live && state.sourceCanvas));
}

function setToolbarDisabled(disabled) {
  ["addCut", "removeCut", "resetCuts", "clearCuts", "share", "downloadAll", "downloadZip"].forEach((id) => {
    $(`#${id}`).disabled = disabled;
  });
}

function clearPreview({ keepLive = false } = {}) {
  clearTimeout(state.outputTimer);
  state.sourceCanvas = null;
  state.cuts = [];
  state.outputFiles = null;
  state.paragraphEnds = [];
  state.addingCut = false;
  state.removingCut = false;
  if (!keepLive) state.livePreview = false;
  $("#canvasWrap").classList.add("hidden");
  $("#canvasWrap").classList.remove("adding-cut", "removing-cut");
  $("#empty").classList.remove("hidden");
  $("#previewToolbar").classList.add("hidden");
  $("#singleDownloads").classList.add("hidden");
  $("#singleDownloadList").replaceChildren();
  $("#count").textContent = "—";
  setToolbarDisabled(true);
  setPreviewStatus(state.livePreview ? "等待內容" : "尚未產生", false);
}

function selectedSize() {
  if (state.ratio === "custom") {
    return {
      width: clamp(Number($("#width").value), 320, 2400),
      height: clamp(Number($("#height").value), 400, 3200),
    };
  }
  const [width, height] = RATIOS[state.ratio];
  return { width, height };
}

function syncResolvedSize() {
  const { width, height } = selectedSize();
  $("#resolvedWidth").value = width;
  $("#resolvedHeight").value = height;
  $("#sizeSummary").textContent = state.ratio === "custom"
    ? `自訂輸出基準：${width} × ${height} px`
    : `輸出基準：${width} × ${height} px（智慧尋找附近段落）`;
  return { width, height };
}

function selectRatio(ratio) {
  state.ratio = ratio;
  $$(".ratio-option").forEach((button) => button.classList.toggle("active", button.dataset.ratio === ratio));
  $("#customSize").classList.toggle("hidden", ratio !== "custom");
  syncResolvedSize();
  if (state.mode === "split" && state.sourceCanvas) {
    resetCuts();
    setPreviewStatus("即時預覽中", true);
  } else {
    scheduleLivePreview("layout", 180);
  }
}

function parseLines(text) {
  const output = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const trimmed = raw.trim();
    if (/^([-－]\s*){3,}$|^([*＊]\s*){3,}$|^([_＿]\s*){3,}$/.test(trimmed)) {
      output.push({ kind: "rule" });
      continue;
    }
    const quote = /^[>＞]/.test(trimmed);
    const body = quote ? trimmed.replace(/^[>＞]\s?/, "").trim() : trimmed;
    if (!body) {
      output.push({ kind: "blank", quote });
      continue;
    }
    output.push({ kind: "text", text: body, quote });
  }
  while (output.length && output[0].kind === "blank") output.shift();
  while (output.length && output.at(-1).kind === "blank") output.pop();
  return output;
}

function parseInline(text) {
  const output = [];
  let light = false;
  let bold = false;
  for (let index = 0; index < text.length;) {
    if (text.startsWith("**", index)) {
      bold = !bold;
      index += 2;
      continue;
    }
    const codePoint = text.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    if (character === "*") {
      light = !light;
      index += 1;
      continue;
    }
    output.push({ ch: character, light, bold, redact: false });
    index += character.length;
  }
  return output;
}

function redactWordList() {
  return [...new Set(
    ($("#redactWords").value || "")
      .split(/[,，、;；\n]+/)
      .map((item) => item.replace(/\*/g, "").trim())
      .filter(Boolean),
  )];
}

function redactMode() {
  return document.querySelector('input[name="redactMode"]:checked')?.value || "same";
}

function redactColorFor(word) {
  return redactMode() === "same" ? $("#redactColor").value : (redactColors[word] || "#252525");
}

function getRedactWords() {
  return redactWordList()
    .sort((a, b) => b.length - a.length)
    .map((word) => ({ word, graphemes: graphemes(word) }));
}

function renderRedactList() {
  const list = $("#redactList");
  const words = redactWordList();
  const each = redactMode() === "each";
  list.classList.toggle("hidden", !each || !words.length);
  $(".redact-same").style.visibility = each ? "hidden" : "visible";
  if (!each) return;
  let paletteIndex = Object.keys(redactColors).length;
  words.forEach((word) => {
    if (!redactColors[word]) redactColors[word] = REDACT_PALETTE[paletteIndex++ % REDACT_PALETTE.length];
  });
  list.replaceChildren();
  words.forEach((word) => {
    const chip = document.createElement("label");
    chip.className = "redact-chip";
    const input = document.createElement("input");
    input.type = "color";
    input.value = redactColors[word];
    input.addEventListener("input", () => {
      redactColors[word] = input.value;
      scheduleLivePreview("visual", 80);
    });
    const label = document.createElement("span");
    label.textContent = word;
    chip.append(input, label);
    list.append(chip);
  });
}

function markRedactions(characters, words) {
  if (!words.length) return;
  for (let index = 0; index < characters.length; index += 1) {
    for (const item of words) {
      if (index + item.graphemes.length > characters.length) continue;
      const matches = item.graphemes.every((character, offset) => characters[index + offset].ch === character);
      if (!matches) continue;
      for (let offset = 0; offset < item.graphemes.length; offset += 1) characters[index + offset].redact = item.word;
      index += item.graphemes.length - 1;
      break;
    }
  }
}

function fontWeight(itemBold = false) {
  return $("#boldAll").checked || itemBold ? 700 : 400;
}

function canvasFont(weight, size, family) {
  return `${weight} ${size}px ${family}`;
}

function makeTextCanvas(text) {
  const { width, height: targetHeight } = selectedSize();
  const fontSize = clamp(Number($("#fontSize").value), 18, 120);
  const padding = clamp(Number($("#padding").value), 32, 180);
  const lineHeight = Math.round(fontSize * 1.72);
  const blankHeight = Math.round(lineHeight * .62);
  const ruleHeight = Math.round(lineHeight * 1.1);
  const quoteIndent = Math.round(fontSize * 1.1);
  const family = fonts[$("#fontFamily").value].family;
  const measure = document.createElement("canvas").getContext("2d");
  const rows = [];
  const redactWords = getRedactWords();
  let previousKind = null;

  for (const line of parseLines(text)) {
    if (line.kind === "blank") {
      if (previousKind !== "blank") rows.push({ type: "gap", quote: line.quote, height: blankHeight, end: true });
      previousKind = "blank";
      continue;
    }
    if (line.kind === "rule") {
      if (rows.length) rows.at(-1).end = true;
      rows.push({ type: "rule", height: ruleHeight, end: true });
      previousKind = "rule";
      continue;
    }

    const maximumWidth = width - padding * 2 - (line.quote ? quoteIndent : 0);
    let row = [];
    let rowWidth = 0;
    const characters = parseInline(line.text);
    markRedactions(characters, redactWords);

    for (const item of characters) {
      const weight = fontWeight(item.bold);
      measure.font = canvasFont(weight, fontSize, family);
      const characterWidth = measure.measureText(item.ch).width;
      const measured = { ...item, width: characterWidth, weight };
      if (row.length && rowWidth + characterWidth > maximumWidth) {
        if (NO_START.includes(item.ch)) {
          row.push(measured);
          rowWidth += characterWidth;
          continue;
        }
        let carry = [];
        if (row.length > 1 && NO_END.includes(row.at(-1).ch)) carry = [row.pop()];
        rows.push({ type: "text", items: row, quote: line.quote, height: lineHeight });
        row = carry;
        rowWidth = carry.reduce((sum, character) => sum + character.width, 0);
      }
      row.push(measured);
      rowWidth += characterWidth;
    }
    rows.push({ type: "text", items: row, quote: line.quote, height: lineHeight });
    previousKind = "text";
  }

  if (rows.length) rows.at(-1).end = true;
  const contentHeight = rows.reduce((sum, row) => sum + row.height, 0);
  const canvasHeight = Math.max(targetHeight, padding * 2 + contentHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = $("#bg").value;
  context.fillRect(0, 0, width, canvasHeight);
  context.textBaseline = "top";

  let y = padding;
  const paragraphEnds = [];
  let quoteStart = null;
  const inset = Math.round((lineHeight - fontSize) / 2);
  const barWidth = Math.max(3, Math.round(fontSize * .12));
  const closeQuote = (endY) => {
    if (quoteStart === null) return;
    context.fillStyle = $("#light").value;
    context.fillRect(padding + Math.round(fontSize * .1), quoteStart + inset * .5, barWidth, endY - quoteStart - inset);
    quoteStart = null;
  };

  rows.forEach((row, index) => {
    const isQuote = row.type !== "rule" && row.quote;
    const next = rows[index + 1];
    if (isQuote && quoteStart === null) quoteStart = y;

    if (row.type === "text") {
      let x = padding + (row.quote ? quoteIndent : 0);
      for (const item of row.items) {
        if (item.redact) {
          context.fillStyle = redactColorFor(item.redact);
          context.fillRect(Math.floor(x), Math.round(y + inset - fontSize * .1), Math.ceil(item.width) + 1, Math.round(fontSize * 1.2));
        } else {
          context.font = canvasFont(item.weight, fontSize, family);
          context.fillStyle = item.light ? $("#light").value : $("#dark").value;
          context.fillText(item.ch, x, y + inset);
        }
        x += item.width;
      }
    } else if (row.type === "rule") {
      context.fillStyle = $("#dark").value;
      const thickness = Math.max(2, Math.round(fontSize * .05));
      context.fillRect(padding, Math.round(y + row.height / 2 - thickness / 2), width - padding * 2, thickness);
    }

    y += row.height;
    if (quoteStart !== null && !(next && next.type !== "rule" && next.quote)) closeQuote(row.type === "gap" ? y - row.height : y);
    if (row.end) paragraphEnds.push(row.type === "gap" ? y - row.height / 2 : y);
  });
  closeQuote(y);
  state.paragraphEnds = paragraphEnds.filter((value) => value > padding && value < canvasHeight - padding / 2);
  return canvas;
}

async function ensureFont(text) {
  const font = fonts[$("#fontFamily").value];
  if (!document.fonts?.load) return;
  const characters = [...new Set([...text.replace(/[\s*>]/g, "")])].join("") || "字";
  const fontSize = clamp(Number($("#fontSize").value), 18, 120);
  const requests = [
    document.fonts.load(`${fontWeight(false)} ${fontSize}px ${font.family}`, characters),
    document.fonts.load(`700 ${fontSize}px ${font.family}`, characters),
  ];
  if (font.load) requests.push(document.fonts.load(`400 ${fontSize}px "${font.load}"`, characters));
  try {
    await Promise.race([Promise.all(requests), new Promise((resolve) => setTimeout(resolve, 6000))]);
  } catch (error) {
    console.debug("Font loading fallback", error);
  }
}

function smartCuts(totalHeight, targetHeight) {
  const cuts = [];
  let y = targetHeight;
  const minimumGap = Math.max(160, targetHeight * .35);
  while (y < totalHeight - 80) {
    let best = y;
    if (state.paragraphEnds.length) {
      const nearby = state.paragraphEnds.filter((value) =>
        Math.abs(value - y) < targetHeight * .22 && value - (cuts.at(-1) || 0) > minimumGap,
      );
      if (nearby.length) best = nearby.sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
    }
    cuts.push(Math.round(best));
    y = best + targetHeight;
  }
  return cuts;
}

function adaptCuts(previousCuts, previousHeight, newHeight) {
  if (!previousHeight) return smartCuts(newHeight, selectedSize().height);
  if (!previousCuts.length) return [];
  const targetHeight = selectedSize().height;
  const scale = newHeight / previousHeight;
  const adapted = [];
  for (const oldCut of previousCuts) {
    const scaled = oldCut * scale;
    const nearby = state.paragraphEnds.filter((value) => Math.abs(value - scaled) <= targetHeight * .18);
    const snapped = nearby.length
      ? nearby.sort((a, b) => Math.abs(a - scaled) - Math.abs(b - scaled))[0]
      : scaled;
    const rounded = Math.round(snapped);
    const previous = adapted.at(-1) || 0;
    if (rounded - previous >= 80 && newHeight - rounded >= 80) adapted.push(rounded);
  }
  return adapted;
}

function copyImageToCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  state.paragraphEnds = [];
  return canvas;
}

function showCanvas(canvas, { strategy = "auto", previousCuts = [], previousHeight = 0 } = {}) {
  state.sourceCanvas = canvas;
  const visibleCanvas = $("#canvas");
  visibleCanvas.width = canvas.width;
  visibleCanvas.height = canvas.height;
  visibleCanvas.getContext("2d").drawImage(canvas, 0, 0);

  if (strategy === "exact") {
    state.cuts = previousCuts.filter((value, index) => {
      const lower = index ? previousCuts[index - 1] : 0;
      return value - lower >= 80 && canvas.height - value >= 80;
    });
  } else if (strategy === "adapt") {
    state.cuts = adaptCuts(previousCuts, previousHeight, canvas.height);
  } else {
    state.cuts = smartCuts(canvas.height, selectedSize().height);
  }

  $("#canvasWrap").classList.remove("hidden");
  $("#empty").classList.add("hidden");
  $("#previewToolbar").classList.remove("hidden");
  setToolbarDisabled(false);
  requestAnimationFrame(renderCuts);
}

async function renderText(text, strategy = "auto") {
  const token = ++state.renderToken;
  const previousCuts = [...state.cuts];
  const previousHeight = state.sourceCanvas?.height || 0;
  setPreviewStatus("正在更新…", false);
  await ensureFont(text);
  if (token !== state.renderToken) return;
  const canvas = makeTextCanvas(text);
  if (token !== state.renderToken) return;
  showCanvas(canvas, { strategy, previousCuts, previousHeight });
  setPreviewStatus("即時預覽中", true);
}

function scheduleLivePreview(kind = "layout", delay = 320) {
  if (!state.livePreview) return;
  if (kind === "layout") state.renderKind = "layout";
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(async () => {
    const requestedKind = state.renderKind;
    state.renderKind = "visual";
    if (state.mode === "split") {
      if (state.sourceCanvas) resetCuts();
      return;
    }
    const text = $("#textInput").value.trim();
    if (!text) {
      clearPreview({ keepLive: true });
      return;
    }
    try {
      await renderText(text, requestedKind === "visual" ? "exact" : "adapt");
    } catch (error) {
      console.error(error);
      setPreviewStatus("更新失敗", false);
      toast("預覽更新失敗，請再試一次");
    }
  }, delay);
}

function resetCuts() {
  if (!state.sourceCanvas) return;
  setAddMode(false);
  setRemoveMode(false, false);
  state.cuts = smartCuts(state.sourceCanvas.height, selectedSize().height);
  renderCuts();
}

function setAddMode(enabled) {
  state.addingCut = Boolean(enabled && state.sourceCanvas);
  if (state.addingCut && state.removingCut) setRemoveMode(false, false);
  $("#canvasWrap").classList.toggle("adding-cut", state.addingCut);
  $("#addCut").classList.toggle("active", state.addingCut);
  $("#addCut").innerHTML = state.addingCut ? "<span>＋</span>點預覽放置" : "<span>＋</span>新增線";
}

function setRemoveMode(enabled, shouldRender = true) {
  state.removingCut = Boolean(enabled && state.sourceCanvas);
  if (state.removingCut && !state.cuts.length) {
    state.removingCut = false;
    toast("目前沒有切割線可以移除");
  }
  if (state.removingCut) setAddMode(false);
  $("#canvasWrap").classList.toggle("removing-cut", state.removingCut);
  $("#removeCut").classList.toggle("active", state.removingCut);
  $("#removeCut").innerHTML = state.removingCut ? "<span>×</span>點把手刪除" : "<span>−</span>移除線";
  if (shouldRender && state.sourceCanvas) renderCuts();
}

function renderCuts() {
  if (!state.sourceCanvas) return;
  const layer = $("#cuts");
  layer.replaceChildren();
  const scale = (layer.clientHeight || $("#canvas").clientHeight) / state.sourceCanvas.height;

  state.cuts.forEach((cutY, index) => {
    const cut = document.createElement("div");
    cut.className = "cut";
    cut.style.top = `${cutY * scale - 2}px`;
    cut.innerHTML = `<span class="cut-handle" aria-hidden="true">${state.removingCut ? "×" : "≡"}</span><span class="cut-label">${index + 1}／${state.cuts.length + 1}</span>`;
    let startPointerY = 0;
    let startCutY = 0;

    const move = (event) => {
      event.preventDefault();
      const delta = (event.clientY - startPointerY) / scale;
      const lower = (index ? state.cuts[index - 1] : 0) + 80;
      const upper = (index < state.cuts.length - 1 ? state.cuts[index + 1] : state.sourceCanvas.height) - 80;
      state.cuts[index] = Math.round(clamp(startCutY + delta, lower, upper));
      cut.style.top = `${state.cuts[index] * scale - 2}px`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderCuts();
    };
    const down = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.removingCut) {
        state.cuts.splice(index, 1);
        setRemoveMode(false, false);
        renderCuts();
        toast("已移除切割線");
        return;
      }
      setAddMode(false);
      startPointerY = event.clientY;
      startCutY = state.cuts[index];
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up, { once: true });
    };
    cut.addEventListener("pointerdown", down);
    layer.append(cut);
  });

  $("#count").textContent = `${state.cuts.length + 1} 張`;
  state.outputFiles = null;
  $("#singleDownloads").classList.add("hidden");
  clearTimeout(state.outputTimer);
  state.outputTimer = setTimeout(async () => {
    try {
      state.outputFiles = await makeOutputFiles();
      renderSingleDownloads(state.outputFiles);
    } catch (error) {
      console.error(error);
    }
  }, 280);
}

async function makeOutputFiles() {
  if (!state.sourceCanvas) return [];
  const boundaries = [0, ...state.cuts, state.sourceCanvas.height];
  const files = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const height = boundaries[index + 1] - boundaries[index];
    const canvas = document.createElement("canvas");
    canvas.width = state.sourceCanvas.width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(
      state.sourceCanvas,
      0,
      boundaries[index],
      canvas.width,
      height,
      0,
      0,
      canvas.width,
      height,
    );
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("圖片建立失敗")),
      "image/png",
    ));
    files.push(new File([blob], `圖卡_${String(index + 1).padStart(2, "0")}.png`, { type: "image/png" }));
  }
  return files;
}

function renderSingleDownloads(files) {
  const list = $("#singleDownloadList");
  list.replaceChildren();
  files.forEach((file, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `圖卡 ${String(index + 1).padStart(2, "0")} ↓`;
    button.addEventListener("click", () => downloadFile(file));
    list.append(button);
  });
  $("#singleDownloads").classList.toggle("hidden", !files.length);
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function getOutputFiles() {
  return state.outputFiles || makeOutputFiles();
}

async function downloadAllImages() {
  if (!state.sourceCanvas) return;
  $("#downloadAll").disabled = true;
  try {
    const files = await getOutputFiles();
    for (const file of files) {
      downloadFile(file);
      await new Promise((resolve) => setTimeout(resolve, 220));
    }
    toast(`已下載 ${files.length} 張 PNG`);
  } catch (error) {
    console.error(error);
    toast("圖片下載失敗，請再試一次");
  } finally {
    $("#downloadAll").disabled = false;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function zipHeader(size, writer) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  writer({
    u16(offset, value) { view.setUint16(offset, value, true); },
    u32(offset, value) { view.setUint32(offset, value >>> 0, true); },
  });
  return bytes;
}

async function buildZip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const centralParts = [];
  const records = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    const crc = crc32(data);
    const local = zipHeader(30, ({ u16, u32 }) => {
      u32(0, 0x04034b50); u16(4, 20); u16(6, 0x0800); u16(8, 0);
      u16(10, stamp.time); u16(12, stamp.date); u32(14, crc);
      u32(18, data.length); u32(22, data.length); u16(26, name.length); u16(28, 0);
    });
    parts.push(local, name, data);
    records.push({ name, dataLength: data.length, crc, offset });
    offset += local.length + name.length + data.length;
  }

  const centralOffset = offset;
  for (const record of records) {
    const central = zipHeader(46, ({ u16, u32 }) => {
      u32(0, 0x02014b50); u16(4, 20); u16(6, 20); u16(8, 0x0800); u16(10, 0);
      u16(12, stamp.time); u16(14, stamp.date); u32(16, record.crc);
      u32(20, record.dataLength); u32(24, record.dataLength); u16(28, record.name.length);
      u16(30, 0); u16(32, 0); u16(34, 0); u16(36, 0); u32(38, 0); u32(42, record.offset);
    });
    centralParts.push(central, record.name);
    offset += central.length + record.name.length;
  }
  const centralSize = offset - centralOffset;
  const end = zipHeader(22, ({ u16, u32 }) => {
    u32(0, 0x06054b50); u16(4, 0); u16(6, 0); u16(8, records.length); u16(10, records.length);
    u32(12, centralSize); u32(16, centralOffset); u16(20, 0);
  });
  return new Blob([...parts, ...centralParts, end], { type: "application/zip" });
}

function dateStamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

async function downloadZip() {
  if (!state.sourceCanvas) return;
  const button = $("#downloadZip");
  button.disabled = true;
  const original = button.innerHTML;
  button.innerHTML = "<span>ZIP</span>打包中…";
  try {
    const files = await getOutputFiles();
    const blob = await buildZip(files);
    downloadFile(new File([blob], `劇情圖卡_${dateStamp()}.zip`, { type: "application/zip" }));
    toast(`已將 ${files.length} 張圖片打包成 ZIP`);
  } catch (error) {
    console.error(error);
    toast("ZIP 建立失敗，請再試一次");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function shareImages() {
  if (!state.sourceCanvas) return;
  const button = $("#share");
  button.disabled = true;
  try {
    const files = await getOutputFiles();
    if (navigator.share && navigator.canShare?.({ files })) {
      await navigator.share({ files, title: "劇情圖卡", text: "選擇儲存影像即可加入相簿" });
      toast("已交給裝置處理");
    } else {
      toast("此瀏覽器不支援多圖分享，已改為 ZIP 下載");
      await downloadZip();
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      toast("無法開啟分享，請再試一次");
    }
  } finally {
    button.disabled = false;
  }
}

function updateFontPreview() {
  const font = fonts[$("#fontFamily").value];
  $("#fontPreview").style.fontFamily = font.family;
  $("#fontPreview").style.fontWeight = $("#boldAll").checked ? "700" : "400";
  $("#fontNote").textContent = font.note || "";
}

function updateColorLabel(inputId, labelId) {
  $(labelId).textContent = $(inputId).value.toUpperCase();
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("請選擇圖片檔");
    return;
  }
  const image = new Image();
  const sourceUrl = URL.createObjectURL(file);
  image.onload = () => {
    URL.revokeObjectURL(sourceUrl);
    state.img = image;
    state.livePreview = true;
    showCanvas(copyImageToCanvas(image), { strategy: "auto" });
    setPreviewStatus("切割預覽中", true);
    toast(`已載入 ${image.naturalWidth} × ${image.naturalHeight}`);
  };
  image.onerror = () => {
    URL.revokeObjectURL(sourceUrl);
    toast("圖片無法讀取");
  };
  image.src = sourceUrl;
}

async function generatePreview() {
  if (state.mode === "split") {
    if (!state.img) return toast("請先選擇長圖");
    state.livePreview = true;
    showCanvas(copyImageToCanvas(state.img), { strategy: "auto" });
    setPreviewStatus("切割預覽中", true);
    return;
  }
  const text = $("#textInput").value.trim();
  if (!text) return toast("請先貼上文字");
  const button = $("#generate");
  button.disabled = true;
  state.livePreview = true;
  try {
    await renderText(text, "auto");
    button.querySelector("span").textContent = "重新產生預覽";
    button.querySelector("small").textContent = "即時預覽已開啟，調整設定會自動更新";
  } catch (error) {
    state.livePreview = false;
    console.error(error);
    toast("預覽產生失敗，請再試一次");
  } finally {
    button.disabled = false;
  }
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  try {
    context.registerTool({
      name: "stage_text_cards",
      title: "產生文字圖卡預覽",
      description: "將文字放入編輯器並產生智慧切割預覽。",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" }, width: { type: "number" }, height: { type: "number" } },
        required: ["text"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => {
        if (state.mode !== "text") setMode("text");
        $("#textInput").value = String(input.text || "");
        updateCharacterCount();
        if (input.width || input.height) {
          selectRatio("custom");
          if (input.width) $("#width").value = clamp(input.width, 320, 2400);
          if (input.height) $("#height").value = clamp(input.height, 400, 3200);
          syncResolvedSize();
        }
        state.livePreview = true;
        await renderText($("#textInput").value, "auto");
        return { cards: state.cuts.length + 1, width: state.sourceCanvas.width, height: state.sourceCanvas.height };
      },
    });
  } catch (error) {
    console.debug(error);
  }
}

function initializeApp() {
$$(".mode-tab").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
$$(".ratio-option").forEach((button) => button.addEventListener("click", () => {
  selectRatio(button.dataset.ratio);
  saveSettings();
}));

$("#expandEditor").addEventListener("click", () => {
  const expanded = document.body.classList.toggle("editor-expanded");
  $("#expandEditor").textContent = expanded ? "收合編輯" : "展開編輯";
  $("#expandEditor").setAttribute("aria-expanded", String(expanded));
  if (expanded) $("#textInput").focus();
});
$("#editorShorter").addEventListener("click", () => adjustEditorHeight(-140));
$("#editorTaller").addEventListener("click", () => adjustEditorHeight(140));

$("#textInput").addEventListener("input", () => {
  updateCharacterCount();
  scheduleLivePreview("layout", 420);
});
$("#generate").addEventListener("click", generatePreview);

$("#fontFamily").addEventListener("change", () => {
  updateFontPreview();
  scheduleLivePreview("layout", 180);
});
$("#boldAll").addEventListener("change", () => {
  updateFontPreview();
  scheduleLivePreview("layout", 180);
});
$("#fontSize").addEventListener("input", () => scheduleLivePreview("layout", 240));
$("#padding").addEventListener("input", (event) => {
  $("#paddingValue").textContent = `${event.target.value} px`;
  scheduleLivePreview("layout", 180);
});

["width", "height"].forEach((id) => $("#" + id).addEventListener("input", () => {
  syncResolvedSize();
  scheduleLivePreview("layout", 240);
}));

$("#redactWords").addEventListener("input", () => {
  renderRedactList();
  scheduleLivePreview("visual", 320);
});
$("#redactColor").addEventListener("input", () => scheduleLivePreview("visual", 70));
$$('input[name="redactMode"]').forEach((radio) => radio.addEventListener("change", () => {
  renderRedactList();
  scheduleLivePreview("visual", 80);
  saveSettings();
}));

[
  ["#bg", "#bgHex"],
  ["#dark", "#darkHex"],
  ["#light", "#lightHex"],
].forEach(([input, label]) => $(input).addEventListener("input", () => {
  updateColorLabel(input, label);
  scheduleLivePreview("visual", 60);
}));

SAVED_CONTROL_IDS.forEach((id) => {
  $("#" + id).addEventListener("input", saveSettings);
  $("#" + id).addEventListener("change", saveSettings);
});
$("#resetSettings").addEventListener("click", resetSavedSettings);

$("#addCut").addEventListener("click", () => setAddMode(!state.addingCut));
$("#removeCut").addEventListener("click", () => setRemoveMode(!state.removingCut));
$("#resetCuts").addEventListener("click", () => {
  resetCuts();
  toast("已重新依段落自動切割");
});
$("#clearCuts").addEventListener("click", () => {
  if (!state.sourceCanvas) return;
  if (!state.cuts.length) return toast("目前沒有切割線");
  setAddMode(false);
  setRemoveMode(false, false);
  state.cuts = [];
  renderCuts();
  toast("已清空切割線，將輸出完整長圖");
});

$("#canvasWrap").addEventListener("pointerdown", (event) => {
  if (!state.addingCut || event.target.closest(".cut")) return;
  event.preventDefault();
  const rectangle = $("#canvas").getBoundingClientRect();
  const y = Math.round((event.clientY - rectangle.top) / rectangle.height * state.sourceCanvas.height);
  if (y < 80 || y > state.sourceCanvas.height - 80 || state.cuts.some((value) => Math.abs(value - y) < 80)) {
    toast("這裡離其他切割線太近了");
    return;
  }
  state.cuts.push(y);
  state.cuts.sort((a, b) => a - b);
  setAddMode(false);
  renderCuts();
  toast("已新增切割線");
});

$("#downloadAll").addEventListener("click", downloadAllImages);
$("#downloadZip").addEventListener("click", downloadZip);
$("#share").addEventListener("click", shareImages);

$("#fileInput").addEventListener("change", (event) => loadFile(event.target.files[0]));
const drop = $("#drop");
["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (event) => {
  event.preventDefault();
  drop.classList.add("drag");
}));
["dragleave", "drop"].forEach((type) => drop.addEventListener(type, (event) => {
  event.preventDefault();
  drop.classList.remove("drag");
}));
drop.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));

window.addEventListener("resize", () => {
  if (state.sourceCanvas) requestAnimationFrame(renderCuts);
});

applySettings(safeStoredSettings() || SETTINGS_DEFAULTS);
updateCharacterCount();
registerWebMCP();
}

if (typeof document !== "undefined") initializeApp();

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildZip,
    crc32,
    dosDateTime,
    makeTextCanvas,
    parseInline,
    parseLines,
    smartCuts,
    state,
    RATIOS,
    collectSettings,
    normalizeSettings,
    SETTINGS_DEFAULTS,
  };
}
