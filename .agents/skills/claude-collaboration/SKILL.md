---
name: claude-collaboration
description: 在文王聖卦專案中由 Codex 獨立檢查、交給真正的 Claude 修正，再複驗並持續回交，直到本輪已知問題與驗收全部通過。用於使用者要求與 Claude 協同修程式的工作。
---

# Claude 協同複查

使用者已授權 Codex 檢查 → Claude 修正 → Codex 複驗的持續循環。不要每輪要求使用者轉貼或確認。這是由目前代理持續執行的工作流程，沒有建立關閉對話後繼續運作的排程服務。

## 執行方式

1. 先讀 `git status`、差異、上輪報告與相關程式。確認其他 Claude 回合已結束；同一檔只由一方寫入。用 `tmp/claude-collaboration/<日期時間>/` 保留本輪資料，記錄 HEAD、程式 SHA256、既有修改與凍結語料雜湊。
2. Codex 自行重現可驗證的問題。檢查主問／背景、代問人物、自動與手動用神、吉凶依據、分析／教學／解卦一致性。解卦要自然、擬人，先答主問再講卦理；不得替未指明的人猜心情或捏造病情。檢查直接輸出與實際畫面，不能只搜尋關鍵字就定案。
3. 將每項問題的輸入、性別、日期、卦象或亂數種子、實際／預期、程式位置與證據寫進 `findings.txt`。附正例和反例，區分缺陷與取用政策分歧。先加會失敗的永久測試，再修正。不得修改原語料、標註或盲測來消除失敗。
4. 呼叫真正的 Claude CLI。新工作預設新會話；續接時使用上一輪回執的 session_id。若要續接 VS Code 原對話，必須先確認該對話已閒置。工具會保存輸入、完整串流及真實回執，不把工具呼叫成功當成修正成功。

   ```powershell
   python .agents/skills/claude-collaboration/scripts/collaborate.py handoff --findings tmp/本輪/findings.txt --out tmp/本輪/claude-01
   ```

   `--session <回執中的 session_id>` 可續接；`--model` 可指定已可用模型。目前本機已驗證的預設為 `claude-sonnet-5-5`，不是自動挑選最新模型。不修改全域設定或自動升級 CLI。`--ack` 僅讀取報告並回覆，不允許修改或執行 shell。

5. Claude 完成後，Codex 審查實際 diff、重新跑原失敗案例及鄰近反例，確認沒有寫死問句、削弱測試、改答案、改壞主問或語氣。若仍有問題，以新證據目錄再次回交第 3 步；保留上一輪失敗，不覆寫。
6. 快速複驗只跑相關測試；候選修正穩定後執行一次完整固定驗收：

   ```powershell
   python .agents/skills/claude-collaboration/scripts/collaborate.py check --out tmp/本輪/final-check
   ```

   工具執行全部十一組 Node 驗收（含 131072 次固定範圍分析及離線／跨分頁狀態）及流程工具測試，檢查退出碼、JSON 失敗、439 題實際答對數、缺少測試與來源穩定性。`passed: true` **只是機械驗收通過**。Codex 還須核對凍結資料、實際解卦內容，以及受改動影響的 Chrome 操作和跨頁輸出。計分應不變時，用固定卦例比較數值／判詞；必要修正若改變計分，逐項說明並獨立驗證，不能隱藏差異。
7. 只有已知缺陷全部重現確認修好、沒有未處理回歸、來源未在驗收中變動，而且 Codex 完成獨立複核，才可標示本輪完成。若 Claude 沒有修改、重複同一錯誤，改用更小的重現與根因分析繼續；若外部工具不可用或確有資料／政策需要使用者決定，明確記錄未完成與原因。不得以達到輪數、花費上限或純粹「測試綠燈」宣稱修完。
8. 在 `output/review/` 出一份新的 HTML 報告，列問題、修正前後、實際驗證、來源 SHA256、仍有的限制及是否發布；將報告交回 Claude 閱讀並取得回執。由 Codex 管理快取版號與紀錄，避免雙方同改。不自動提交、推送、部署，除非使用者在當輪明確要求或已有相應授權。

## 工具與資料

- [scripts/collaborate.py](scripts/collaborate.py)：固定驗收與 Claude CLI 交接；每次 `--out` 必須尚不存在。
- `before.json`／`after.json` 的雜湊範圍是根目錄 HTML／JS／CSS、`lib/`、`tests/`、`output/blind/` 與本技能；`ackStable` 只表示這個範圍未變，不保證所有檔案未變。報告、README、history 等另以交付 manifest 核對。只讀 Claude 的修改限制由工具白名單實施。workflow 的工具與測試本身也在這兩份快照中，前後變動會使驗收失敗。
- `tests/claude-collaboration.test.py`：驗收工具本身的失敗辨識測試。
- `tests/monitor-followup*`、`tests/narrative-context*`：永久的主問／解卦語境正反例。
- `tests/yongshen-corpus/`、`output/blind/`：保留原標註；曝光資料只作回歸，不能宣稱仍是新盲測。
- 需要醫療、古籍或其他外部事實才能裁定時，另找第一手來源，不靠 Claude 或既有標註互相背書。

專案技能放置方式依 [OpenAI 官方技能文件](https://learn.chatgpt.com/docs/build-skills)。後續可要求「用 claude-collaboration 流程檢查並修到本輪驗收完成」。
