# Glass Task

モバイル向けタスク管理アプリ（開発中）。

## 実装済み
即時メモ、下書き保存、タスク追加、フリックによる状態変更と取消、白基調のガラス調UI、全画面スケルトン、IndexedDB、既存のXP計算、習慣報告、能力、実績、JSON書出し。

## 未完了
Google認証、Cloudflare D1同期、Workers AI、既存機能の完全移植、実ブラウザ検収、本番デプロイ。

## 技術
操作感を検証する現在の試作はHTML/CSS/JavaScript。React/TypeScript/Vite/Motionへの移行は未実施。バックエンドはCloudflare Workers、D1、Workers AIを予定。

publicフォルダを静的サーバーで配信して実行。現在は端末保存のみ。複数タブ同時編集は未対応。秘密鍵は保存しない。
