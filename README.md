# 劇情圖卡

供個人使用的繁體中文長文圖卡排版工具。將劇情文字排成完整長畫布，再依目標比例與段落位置智慧切割成多張 PNG；所有文字與圖片都只在瀏覽器本機處理。

本專案以懶人阿暝的[「劇情分享小幫手」](https://github.com/gloomoon75/long_card)為基礎修改，保留原本的 Canvas 排版與智慧段落切割概念，重做操作介面並擴充功能。

## 功能

- 第一次手動產生後才啟動 Live Preview，貼長文時不會一直重繪。
- 2:3、3:4、3:5、4:5、9:16 比例預設，以及自訂像素尺寸。
- 在目標高度附近優先尋找段落結尾，不強制切斷文字。
- 可拖曳、新增、移除、重設或清空切割線。
- 預覽區吸頂工具列，捲動長預覽時仍能操作。
- 桌機可拖曳調整高度的文字框，以及手機、桌機皆可使用的全螢幕展開編輯。
- 明體、宋體、仿宋體、圓體、手寫與像素字體；新增辰宇落雁體、清松手寫體 2、獅尾四季春、源雲明體與俐方體 11 號。
- 自動記住上次使用的顏色、字體、比例與排版設定，並可一鍵恢復預設。
- 整篇粗體、Markdown `**局部粗體**`，以及選取文字後套用局部字體。
- `*淺色文字*`、`> 引用`、`---` 分隔線與指定詞語遮蔽。
- 手機多圖儲存、電腦一鍵 ZIP 匯出，以及指定單張圖卡下載。
- 長圖上傳與切割。
- 淡粉手繪書本魔法主畫面圖示，支援 iOS 加入主畫面與 Web App manifest。

## 使用方式

1. 貼上文字並調整圖卡設定。
2. 按一次「產生切割預覽」。
3. 第一次產生後，文字、字體、顏色、比例等修改會自動更新。
4. 拖曳粉色切割線微調，或用預覽區工具列新增、移除與重新自動切割。
5. 手機使用「儲存圖片」開啟系統分享選單；電腦可下載 ZIP，也能在預覽下方單獨下載指定圖卡。

## 本機開啟

這是純靜態網站，不需要安裝套件。直接開啟 `index.html` 即可；若瀏覽器限制本機字體或分享功能，可用任一靜態伺服器啟動：

```bash
python3 -m http.server 4173
```

再開啟 `http://localhost:4173`。

## 測試

```bash
node --check app.js
node tests/pure.cjs
node tests/dom-smoke.cjs
```

測試會檢查 Markdown 粗體／淺色解析、引用與分隔線解析、長文 Canvas 排版、智慧切割、CRC32，以及實際建立可通過 `unzip -t` 的 ZIP 檔。

## GitHub Pages

推送到 GitHub 的 `main` 分支後，`.github/workflows/pages.yml` 會自動部署整個靜態網站。第一次使用時，請在倉庫的 **Settings → Pages → Source** 選擇 **GitHub Actions**。

## 授權與原作標示

原作「劇情分享小幫手」Copyright © 2026 懶人阿暝，採用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hant) 授權。

本修改版僅供個人、非商業使用，保留原作者署名、原專案連結與授權說明，並明確標示已修改介面與功能。完整條款請見 [LICENSE](./LICENSE)。第三方字體依各自的 SIL Open Font License 授權。

本次新增字體來源：[辰宇落雁體](https://github.com/Chenyu-otf/chenyuluoyan_thin)、[清松手寫體](https://github.com/jasonhandwriting/JasonHandwriting)、[獅尾四季春](https://github.com/max32002/swei-spring)、[源雲明體](https://github.com/ButTaiwan/genwan-font)、[俐方體 11 號](https://github.com/ACh-K/Cubic-11)。以上皆依各專案標示的 SIL Open Font License 1.1 使用。
