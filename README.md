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

## 分析、教學與解卦的一致性

```powershell
node tests/analysis-views.test.cjs
```

檢查產期與是否懷孕的判斷主體、離職反看、教學實際生剋方向、64 卦／386 條爻文資料結構及跨分頁判詞。自然問句測試全數通過，只表示列出的案例符合預期；任意問句、未明人物關係或多重問題仍可能需要手動確認用神。

## 自動選用神語料（98% 的來源）

```powershell
node tests/yongshen-corpus.test.cjs
```

語料放在 `tests/yongshen-corpus/`，以畫面相同的方式（問句去頭尾空白、採用逐題性別，未填時為「不指定」）呼叫自動選用神：

- `clear.json`：目前歸為明確的題目，計算與既有標註的符合率。390 句網路語料（附出處網址）＋ 49 句補充題；歸類為明確不代表標註已經獨立確認。
- `ambiguous.json`：有分歧、需要人工確認的 214 句，不計分。`candidates` 是原先列出的候選，部分清單與說明不完整，不能將候選外結果直接當成程式錯誤。空候選題另列 `noCandidatesList`，並分別計算有自動選擇和保持空白的數量。
- `known-failures.json`：目前未符合明確題標註的清單。`status` 標示處理狀態（待修、需討論、來源已確認但短句不宜自動判斷等），`note` 記錄判斷理由與查到的來源出處；不能單憑該欄裁定預期正確，仍須核對來源與取用政策。確認修好才移除，標註有疑慮時另列說明。

問句、性別、預期答案、實際錯誤結果四項皆相同才視為已知失敗；其中任一改變而仍答錯時，回傳非零結束碼。已列失敗修好時會列在 `knownFixed`，並在 `knownFixedDetails` 保留性別與預期答案，請核實後從清單移除。修正或確認後可用 `--update` 重寫失敗清單（保留原有的 `status`、`note`）。**結束碼 0 表示沒有新的未列錯誤，不表示全部題目答對**；請同時查看 `failures` 與 `clear.correct`。符合率只代表這份語料，不代表任意問句或占卜的實證準確率。

測試腳本本身的失敗辨識與空候選輸出，也有獨立檢查：

```powershell
node tests/yongshen-corpus-runner.test.cjs
```
