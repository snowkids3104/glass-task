# Cloudflareへの接続

現在はバックエンド未デプロイ。wrangler.jsoncの空欄は実際のアカウント情報を取得してから設定する。

1. Cloudflareにログイン後、D1データベースglass-taskを作る。
2. 返されたdatabase_idを使い、wrangler.jsoncへd1_databases=[{binding:DB,database_name:glass-task,database_id:実ID,migrations_dir:migrations}]を追加する。
3. D1のリモートマイグレーションを適用する。
4. Google Cloud ConsoleでWebアプリのOAuthクライアントを作成。リダイレクトURIを実際の公開オリジン＋/auth/callbackに設定する。
5. vars.APP_ORIGINとGOOGLE_CLIENT_IDを設定。GOOGLE_CLIENT_SECRETはCloudflareのシークレットとして設定する。コードに保存しない。
6. Workersへデプロイ。Googleログイン、ログアウト、ユーザー別保存、競合検出、Workers AIを実際のブラウザで検収する。

AIは明示同意時のみ送信。1ユーザー毎時20回上限。モデル応答は必ず候補確認後に使用する。セッションとOAuth stateはD1にハッシュ化して保存。Google署名鍵でIDトークン検証し、nonce・audience・issuer・期限を検証。ユーザー別の保存はGoogle subで分離。

期限切れsessions/oauth_states、過去のai_usageの定期削除は運用設定時に追加する。
