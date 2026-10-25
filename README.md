# 文王聖卦六爻排盤

三枚銅錢起卦的六爻排盤網頁：自動裝卦（卦宮、世應、六親、六獸、旬空、伏神），附詳細斷卦分析與教學模式，可離線使用（PWA）。

- 開啟：`3-2.html`（`index.html` 會自動導向）
- 曆法：[lunar-javascript](https://github.com/6tail/lunar-javascript)（MIT，見 `lib/lunar.LICENSE.txt`）
- 卦辭爻辭：維基文庫《周易》（公有領域）
- 開發紀錄：`history.md`

## 語境回歸測試

安裝 Node.js 後，在專案根目錄執行：

```powershell
node tests/question-context.test.cjs
```

測試會讀取目前的 `3-2.html` 與本地曆法，核對自動用神、事類及計算結果是否為有限數值。輸出包含程式 SHA256、測試數、失敗數及逐題結果；有失敗時回傳非零結束碼。此測試不代表所有自然語句或占卜結果已被驗證。
