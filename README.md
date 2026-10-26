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

## 吉凶邏輯回歸測試

```powershell
node tests/fortune-logic.test.cjs
```

固定卦例檢查第一、第二層優先級、分數與判詞，以及疾病、離職、改判主體與產期例外。

若要完整重跑四個固定日期、4096 種六爻狀態與八種事類的 131072 次分析：

```powershell
node tests/fortune-exhaustive.test.cjs
```

枚舉測試核對有用用神的第一層吉、第二層凶約束、作用爻狀態及有限分數；每完成一個日期會輸出進度，並以 JSON 列出計數與第一個失敗案例。這些檢查針對程式內部規則一致性，並不代表占卜的實證準確率。
