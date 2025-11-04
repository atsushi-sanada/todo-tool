# コミットメッセージ修正スクリプト

# 使用方法: PowerShellで実行
# .\scripts\fix-commit-messages.ps1

# 注意: このスクリプトは各ブランチのコミットメッセージを修正します
# force pushが必要になるため、慎重に実行してください

Write-Host "コミットメッセージ修正スクリプト" -ForegroundColor Green
Write-Host ""

# 各ブランチとコミットメッセージのマッピング
$branches = @{
    "feature/story-1-project-setup" = @"
Story 1: プロジェクト基盤のセットアップ

- フォルダ構造の作成（css/、js/）
- index.htmlの基本構造作成
- .gitignoreの作成
- README.mdの作成
"@
    "feature/story-2-storage-manager" = @"
Story 2: データ永続化機能の実装（StorageManager）

- StorageManagerクラスの作成
- save()メソッドの実装（エラーハンドリング含む）
- load()メソッドの実装（エラーハンドリング含む）
- clear()メソッドの実装
- LocalStorageの利用可能性チェック機能を追加
"@
    "feature/story-3-validator" = @"
Story 3: 入力値検証機能の実装（Validator）

- Validatorクラスの作成
- validateTitle()メソッドの実装（1-100文字、必須チェック）
- validateDescription()メソッドの実装（最大500文字、任意）
- sanitize()メソッドの実装（XSS対策・HTMLエスケープ）
- sanitizeForTextContent()メソッドの実装（textContent用）
"@
    "feature/story-4-task-manager" = @"
Story 4: タスク管理機能の実装（TaskManager）

- TaskManagerクラスの作成
- addTask()メソッドの実装（UUID生成、日時設定含む）
- getTasks()メソッドの実装
- getTaskById()メソッドの実装
- updateTask()メソッドの実装（作成日時・更新日時管理）
- deleteTask()メソッドの実装
- toggleTask()メソッドの実装
- UUID生成関数の実装（generateUUID）
- データバージョン管理機能の実装
"@
    "feature/story-5-html-structure" = @"
Story 5: HTML構造の実装

- ARIA属性の追加と改善（aria-modal, aria-describedby, aria-label等）
- タスクカード構造のコメント追加（JavaScript実装時の参考用）
- モーダルのバックドロップ要素追加
- 視覚的に隠されたヒントテキスト追加（スクリーンリーダー対応）
- セマンティックHTMLの最適化
- アクセシビリティの向上
"@
    "feature/story-6-css-styles" = @"
Story 6: CSSスタイルの実装

- リセットCSSの実装
- 基本レイアウトの実装（コンテナ、ヘッダー、メイン）
- タスク追加フォームのスタイル
- タスクカードのスタイル（完了状態の視覚的区別含む）
- モーダルのスタイル（アニメーション含む）
- ダイアログのスタイル
- レスポンシブブレークポイントの実装（スマートフォン・タブレット・デスクトップ）
- アニメーション・トランジションの実装
- アクセシビリティに配慮したスタイル（フォーカス表示、コントラスト対応）
- モダンなフラットデザインの適用
"@
    "feature/story-7-ui-updater" = @"
Story 7: UI更新機能の実装（UIUpdater）

- UIUpdaterクラスの作成
- renderTasks()メソッドの実装（ソート機能含む）
- addTaskCard()メソッドの実装
- updateTaskCard()メソッドの実装
- removeTaskCard()メソッドの実装
- clearForm()メソッドの実装
- showModal()メソッドの実装（フォーカス管理含む）
- hideModal()メソッドの実装
- showConfirmDialog()メソッドの実装（Promise返却）
- showError()メソッドの実装
- HTMLエスケープ処理の実装（XSS対策）
- 日付フォーマット機能の実装
- ESCキー・バックドロップクリックでのモーダル閉じる機能
- アクセシビリティ対応（ARIA属性、フォーカス管理）
"@
    "feature/story-8-main-integration" = @"
Story 8: メインアプリケーションの統合（main.js）

- 各モジュールのインポート（StorageManager, Validator, TaskManager, UIUpdater）
- TodoAppクラスの作成
- アプリケーション初期化処理の実装
- イベントハンドラーの実装
  - タスク追加フォームのsubmitイベント
  - タスクカードのチェックボックスクリックイベント（イベントデリゲーション）
  - タスクカードの編集ボタンクリックイベント（イベントデリゲーション）
  - タスクカードの削除ボタンクリックイベント（イベントデリゲーション）
  - モーダルの保存ボタンクリックイベント
  - モーダルのキャンセルボタンクリックイベント
- ページ読み込み時の処理実装（DOMContentLoaded）
- エラーハンドリングの実装
- LocalStorage利用可能性チェック
- バリデーションとサニタイズ処理の統合
"@
    "feature/story-9-integration-test" = @"
Story 9: 機能統合テストと動作確認

- テスト計画書の作成（.cursor_workflow/test-plan.md）
- README.mdにテスト方法を追加
- 全機能テストケースの定義
- エラーハンドリングテストの定義
- レスポンシブデザインテストの定義
- パフォーマンステストの定義
- セキュリティテスト（XSS対策）の定義
- アクセシビリティテストの定義
- ブラウザ互換性テストの定義
"@
}

Write-Host "修正対象のブランチ:" -ForegroundColor Yellow
foreach ($branch in $branches.Keys) {
    Write-Host "  - $branch"
}

Write-Host ""
$confirm = Read-Host "全てのブランチのコミットメッセージを修正しますか？ (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "処理をキャンセルしました。" -ForegroundColor Yellow
    exit
}

# UTF-8エンコーディングでファイルを作成
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($branch in $branches.Keys) {
    Write-Host ""
    Write-Host "ブランチを修正中: $branch" -ForegroundColor Cyan
    
    try {
        # ブランチをチェックアウト
        git checkout $branch 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [スキップ] ブランチが見つかりません: $branch" -ForegroundColor Yellow
            continue
        }
        
        # コミットメッセージを一時ファイルに保存
        $tempFile = [System.IO.Path]::GetTempFileName()
        $branches[$branch] | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
        
        # コミットメッセージを修正
        git commit --amend -F $tempFile
        
        # 一時ファイルを削除
        Remove-Item $tempFile
        
        Write-Host "  [完了] コミットメッセージを修正しました" -ForegroundColor Green
        Write-Host "  次のコマンドでpushしてください: git push --force-with-lease origin $branch" -ForegroundColor Yellow
        
    } catch {
        Write-Host "  [エラー] $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "全てのブランチの修正が完了しました。" -ForegroundColor Green
Write-Host "各ブランチで 'git push --force-with-lease origin <branch-name>' を実行してpushしてください。" -ForegroundColor Yellow
