const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { File } = require("node:buffer");
const { buildZip, crc32, parseInline, parseLines, RATIOS } = require("../app.js");

(async () => {
  const inline = parseInline("普通 **粗體** 與 *淺色* 文字");
  assert.equal(inline.map((item) => item.ch).join(""), "普通 粗體 與 淺色 文字");
  assert.equal(inline.find((item) => item.ch === "粗").bold, true);
  assert.equal(inline.find((item) => item.ch === "淺").light, true);

  const lines = parseLines("第一段\n\n> 引用\n---\n最後一段");
  assert.deepEqual(lines.map((line) => line.kind), ["text", "blank", "text", "rule", "text"]);
  assert.equal(lines[2].quote, true);

  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.deepEqual(RATIOS["9:16"], [1080, 1920]);

  const files = [
    new File(["first"], "圖卡_01.png", { type: "image/png" }),
    new File(["second"], "圖卡_02.png", { type: "image/png" }),
  ];
  const zip = await buildZip(files);
  assert.ok(zip.size > 100);
  const signature = new DataView(await zip.slice(0, 4).arrayBuffer()).getUint32(0, true);
  assert.equal(signature, 0x04034b50);

  const testPath = path.join(os.tmpdir(), `story-cards-${process.pid}.zip`);
  fs.writeFileSync(testPath, Buffer.from(await zip.arrayBuffer()));
  try {
    const listing = execFileSync("unzip", ["-t", testPath], { encoding: "utf8" });
    assert.match(listing, /No errors detected/);
    assert.match(listing, /_01\.png/);
    assert.match(listing, /_02\.png/);
  } finally {
    fs.unlinkSync(testPath);
  }

  console.log(JSON.stringify({ ok: true, zipBytes: zip.size, files: files.length }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
