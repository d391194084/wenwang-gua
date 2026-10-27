# Claude 協同複查流程

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. 使用者已指定 Codex 檢查、Claude 修正、持續複驗的執行方式。

**Goal:** 將已授權的 Codex → Claude → Codex 修正循環存入本專案，後續可再次啟動，不必逐輪詢問。

**Architecture:** 專案技能負責獨立判斷、重現、交接及完成條件。Python 工具只負責呼叫已安裝的 Claude CLI、執行固定驗收與保留證據，不把測試成功當成自動證明所有邏輯正確。

**Tech Stack:** Python 標準庫、既有 Node.js 測試、已登入的 Claude Code CLI。

## 設計與限制

- 採用專案內技能加輕量工具；單純文件缺少可重跑驗收，無人判讀的無限 CLI 迴圈則容易反覆錯修，因此不採用這兩種方式。
- 每次 Codex 審查主問、吉凶、分析／教學／解卦一致性，尤其自然擬人口吻；Claude 修正後須由 Codex 重現複驗。
- 既有語料與原盲測凍結，不調整答案來提高分數。新缺陷新增永久正反例。
- 工具必須拒絕缺少測試、非零退出、JSON 失敗、語料仍有錯題，以及驗收中程式或測試改變。
- 每輪獨立輸出目錄，保留交接、Claude 真實回覆、來源雜湊與測試輸出；不得覆寫舊證據。
- 本輪已知問題全部解決、完整驗收通過、Codex 複驗後才可結案。外部阻礙或反覆失敗時記錄未完成，不假稱成功。
- 不自動提交、推送或發布；保留已有修改，Claude 與 Codex 不同時改同一檔。

## Review Focus

1. 測試退出 0 但 JSON 報告錯誤，必須失敗。
2. 語料允許已知失敗時，不能誤報 100%。
3. 執行中修改程式或標註，必須作廢該輪。
4. Claude CLI 無結果或傳回錯誤，不能當作已送達並修好。
5. 已存在的證據資料夾不能覆寫；路徑含中文或空白須可用。

## Tasks

- [x] 先新增工具測試，確認缺少實作時失敗。
- [x] 新增專案技能、操作工具與精簡 AGENTS 導引，執行工具測試。
- [x] 實際使用工具取得 Claude 回執與完整驗收，檢查完整解卦語境。
- [x] 將本輪問題、修正、驗收和流程入口寫成報告，保留尚未發布狀態。

完成證據：`tmp/claude_recheck_2026-10-27/gate-final/summary.json` 與 `final-feedback/receipt.json`。Claude 兩輪修正後 Codex 獨立驗收通過；最後只讀回執沒有新增 APP 缺陷，雜湊範圍說明補入技能。語境與計分差異詳見本輪 HTML 報告。
