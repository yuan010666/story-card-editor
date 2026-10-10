const assert = require("node:assert/strict");

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : force;
    if (enabled) this.values.add(name); else this.values.delete(name);
    return enabled;
  }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor(value = "") {
    this.value = value;
    this.checked = false;
    this.disabled = false;
    this.style = {};
    this.dataset = {};
    this.classList = new ClassList();
    this.textContent = "";
    this.innerHTML = "";
  }
  addEventListener() {}
  replaceChildren() {}
  append() {}
  appendChild() {}
  setAttribute() {}
  querySelector() { return new FakeElement(); }
}

class FakeCanvas extends FakeElement {
  constructor() {
    super();
    this.width = 300;
    this.height = 150;
    this.context = {
      font: "",
      fillStyle: "",
      textBaseline: "",
      measureText(character) { return { width: character.length * 24 }; },
      fillRect() {},
      fillText() {},
      drawImage() {},
    };
  }
  getContext() { return this.context; }
}

const ids = new Map();
function element(id, value = "") {
  if (!ids.has(id)) ids.set(id, new FakeElement(value));
  return ids.get(id);
}

element("textInput", "");
element("fontFamily", "huninn");
element("fontSize", "42");
element("padding", "96");
element("redactWords", "");
element("redactColor", "#252525");
element("bg", "#f7f3ea");
element("dark", "#252525");
element("light", "#a39e96");
element("width", "1080");
element("height", "1440");
element("resolvedWidth", "1080");
element("resolvedHeight", "1440");
element("boldAll").checked = false;

const ratioButtons = ["2:3", "3:4", "3:5", "4:5", "9:16", "custom"].map((ratio) => {
  const item = new FakeElement();
  item.dataset.ratio = ratio;
  return item;
});
const modeButtons = ["text", "split"].map((mode) => {
  const item = new FakeElement();
  item.dataset.mode = mode;
  return item;
});
const redactRadios = ["same", "each"].map((value, index) => {
  const item = new FakeElement(value);
  item.checked = index === 0;
  return item;
});
const redactSame = new FakeElement();

global.document = {
  body: new FakeElement(),
  fonts: { load: async () => [] },
  modelContext: undefined,
  createElement(tag) { return tag === "canvas" ? new FakeCanvas() : new FakeElement(); },
  querySelector(selector) {
    if (selector.startsWith("#")) return element(selector.slice(1));
    if (selector === ".redact-same") return redactSame;
    if (selector === 'input[name="redactMode"]:checked') return redactRadios[0];
    return new FakeElement();
  },
  querySelectorAll(selector) {
    if (selector === ".mode-tab") return modeButtons;
    if (selector === ".ratio-option") return ratioButtons;
    if (selector === 'input[name="redactMode"]') return redactRadios;
    return [];
  },
};
global.window = { addEventListener() {} };
global.localStorage = {
  value: JSON.stringify({
    ratio: "3:4",
    width: 1080,
    height: 1440,
    fontFamily: "song",
    fontSize: 48,
    boldAll: true,
    padding: 88,
    bg: "#fff1f5",
    dark: "#432735",
    light: "#b8899a",
    redactColor: "#432735",
    redactMode: "same",
  }),
  getItem() { return this.value; },
  setItem(key, value) { this.value = value; },
  removeItem() { this.value = null; },
};

const { makeTextCanvas, normalizeSettings, smartCuts, state } = require("../app.js");

assert.equal(element("fontFamily").value, "song");
assert.equal(element("fontSize").value, 48);
assert.equal(element("boldAll").checked, true);
assert.equal(element("bg").value, "#fff1f5");
assert.equal(element("paddingValue").textContent, "88 px");
assert.deepEqual(normalizeSettings({ fontFamily: "不存在", bg: "粉紅色" }), {
  ratio: "3:4", width: 1080, height: 1440, fontFamily: "huninn", fontSize: 42,
  boldAll: false, padding: 96, bg: "#f7f3ea", dark: "#252525", light: "#a39e96",
  redactColor: "#252525", redactMode: "same",
});

const story = Array.from({ length: 80 }, (_, index) =>
  `第 ${index + 1} 段。這是一段測試自動換行的繁體中文。**這裡要粗體**，*這裡要淺色*。`,
).join("\n\n");
const canvas = makeTextCanvas(story);
assert.equal(canvas.width, 1080);
assert.ok(canvas.height > 1440);
assert.ok(state.paragraphEnds.length >= 70);
const cuts = smartCuts(canvas.height, 1440);
assert.ok(cuts.length > 0);
assert.ok(cuts.every((cut, index) => index === 0 || cut - cuts[index - 1] >= 504));

console.log(JSON.stringify({ ok: true, width: canvas.width, height: canvas.height, paragraphs: state.paragraphEnds.length, cuts: cuts.length }));
