# TODOアプリ 設計書

## 1. 前段階の確認

**参照**: `.cursor_workflow/requirements.md` を読み込みました。

要件定義の主要ポイント：
- MVP機能：タスクの追加、一覧表示、完了状態変更、編集、削除、データ永続化
- 非機能要件：パフォーマンス、ユーザビリティ、セキュリティ、保守性
- 制約：ローカル動作、バックエンドサーバー不要

## 2. 技術スタックの決定

### 2.1 実装技術
- **フロントエンド**: HTML5 + CSS3 + Vanilla JavaScript（ES6+）
- **理由**: 
  - シンプルで依存関係が少ない
  - 学習コストが低い
  - フレームワークなしで実装可能
  - レスポンシブデザインに対応しやすい

### 2.2 データ保存方式
- **LocalStorage**: ブラウザのLocalStorage APIを使用
- **理由**:
  - サーバー不要でローカル動作可能
  - 実装が簡単
  - JSON形式でデータを保存可能

### 2.3 開発ツール
- **エディタ**: Cursor / VS Code
- **バージョン管理**: Git
- **パッケージ管理**: 不要（Vanilla JSのため）

## 3. アーキテクチャ設計

### 3.1 全体構成
```
TODOアプリ
├── プレゼンテーション層（UI）
│   ├── HTML（構造）
│   ├── CSS（スタイル）
│   └── JavaScript（DOM操作・イベント処理）
├── アプリケーション層（ビジネスロジック）
│   ├── タスク管理モジュール
│   ├── データ永続化モジュール
│   └── 検証・サニタイズモジュール
└── データ層（LocalStorage）
    └── JSON形式でタスクデータを保存
```

### 3.2 モジュール構成
- **TaskManager**: タスクのCRUD操作を管理
- **StorageManager**: LocalStorageへの保存・読み込みを管理
- **UIUpdater**: DOM操作とUI更新を管理
- **Validator**: 入力値の検証とサニタイズを管理

## 4. データモデル設計

### 4.1 タスクデータ構造
```javascript
{
  id: string,              // 一意のID（UUID v4形式）
  title: string,           // タスクのタイトル（必須、1-100文字）
  description: string,     // タスクの説明（任意、最大500文字）
  completed: boolean,      // 完了状態（デフォルト: false）
  createdAt: string,       // 作成日時（ISO 8601形式）
  updatedAt: string        // 更新日時（ISO 8601形式）
}
```

### 4.2 ストレージ構造
```javascript
{
  tasks: [                 // タスク配列
    {
      id: "uuid",
      title: "タスクタイトル",
      description: "タスクの説明",
      completed: false,
      createdAt: "2025-01-XXT00:00:00.000Z",
      updatedAt: "2025-01-XXT00:00:00.000Z"
    }
  ],
  version: "1.0.0"         // データフォーマットバージョン
}
```

### 4.3 データ保存キー
- LocalStorageキー: `"todo-app-data"`

## 5. UI/UX設計

### 5.1 画面構成
```
┌─────────────────────────────────────┐
│  TODOアプリ                          │
├─────────────────────────────────────┤
│  [タスク追加フォーム]                 │
│  ┌───────────────────────────────┐  │
│  │ タイトル: [入力フィールド]      │  │
│  │ 説明:    [入力フィールド]      │  │
│  │          [追加ボタン]         │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  [タスク一覧]                        │
│  ┌───────────────────────────────┐  │
│  │ ☐ タスク1 [編集] [削除]       │  │
│  │ ☑ タスク2 [編集] [削除]       │  │
│  │    (取り消し線表示)            │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 5.2 コンポーネント設計

#### 5.2.1 タスク追加フォーム
- **要素**: タイトル入力（required）、説明入力、追加ボタン
- **バリデーション**: タイトルが空の場合、追加ボタンを無効化
- **動作**: 追加ボタンクリックでタスクを追加、フォームをクリア

#### 5.2.2 タスク一覧
- **要素**: タスクカードのリスト
- **表示順**: 作成日時降順（新しい順）
- **タスクカード要素**:
  - チェックボックス（完了状態）
  - タイトル（完了時は取り消し線）
  - 説明（任意表示）
  - 作成日時・更新日時
  - 編集ボタン
  - 削除ボタン

#### 5.2.3 タスク編集モーダル
- **要素**: タイトル入力、説明入力、保存ボタン、キャンセルボタン
- **動作**: モーダル表示、編集内容を保存、モーダルを閉じる

#### 5.2.4 削除確認ダイアログ
- **要素**: 確認メッセージ、削除ボタン、キャンセルボタン
- **動作**: 確認後にタスクを削除

### 5.3 レスポンシブデザイン
- **デスクトップ**: 最大幅800px、中央配置
- **タブレット**: 最大幅100%、左右パディング
- **スマートフォン**: 全幅、パディング調整

## 6. ファイル構成

```
todo-tool/
├── index.html              # メインHTMLファイル
├── css/
│   └── style.css          # スタイルシート
├── js/
│   ├── main.js            # エントリーポイント
│   ├── taskManager.js     # タスク管理ロジック
│   ├── storageManager.js   # LocalStorage操作
│   ├── uiUpdater.js       # DOM操作・UI更新
│   └── validator.js       # 入力検証・サニタイズ
├── .cursor_workflow/      # ワークフロー管理
│   ├── requirements.md
│   └── design.md
├── README.md              # プロジェクト説明
└── .gitignore            # Git除外設定
```

## 7. 処理フロー設計

### 7.1 タスク追加フロー（FR-001）
```
1. ユーザーがフォームに入力
2. バリデーション実行（タイトル必須チェック）
3. 入力値のサニタイズ
4. タスクオブジェクトを作成（ID生成、日時設定）
5. TaskManager.addTask()でタスクを追加
6. StorageManager.save()でLocalStorageに保存
7. UIUpdater.renderTasks()で一覧を更新
8. フォームをクリア
```

### 7.2 タスク一覧表示フロー（FR-002）
```
1. ページ読み込み時、StorageManager.load()でデータ取得
2. タスク配列を取得日時降順でソート
3. UIUpdater.renderTasks()でDOMを生成
4. 各タスクカードをリストに追加
5. 完了状態に応じてスタイルを適用
```

### 7.3 タスク完了状態変更フロー（FR-003）
```
1. チェックボックスクリックイベント
2. タスクIDを取得
3. TaskManager.toggleTask()で状態を反転
4. StorageManager.save()で保存
5. UIUpdater.updateTaskCard()で該当カードを更新
6. 完了状態に応じてスタイルを適用
```

### 7.4 タスク編集フロー（FR-004）
```
1. 編集ボタンクリックイベント
2. タスクIDを取得
3. モーダルを表示し、現在の値を入力フィールドに設定
4. ユーザーが編集
5. 保存ボタンクリック
6. バリデーション実行
7. 入力値のサニタイズ
8. TaskManager.updateTask()でタスクを更新
9. StorageManager.save()で保存
10. UIUpdater.updateTaskCard()で該当カードを更新
11. モーダルを閉じる
```

### 7.5 タスク削除フロー（FR-005）
```
1. 削除ボタンクリックイベント
2. タスクIDを取得
3. 確認ダイアログを表示
4. ユーザーが確認
5. TaskManager.deleteTask()でタスクを削除
6. StorageManager.save()で保存
7. UIUpdater.removeTaskCard()で該当カードを削除
```

### 7.6 データ永続化フロー（FR-006）
```
1. タスク操作（追加・更新・削除）のたびに実行
2. TaskManager.getTasks()で現在のタスク配列を取得
3. StorageManager.save()でJSON文字列に変換
4. LocalStorage.setItem()で保存
5. エラーハンドリング（ストレージ容量不足等）
```

## 8. 関数設計

### 8.1 TaskManager モジュール
```javascript
class TaskManager {
  constructor(storageManager)
  addTask(title, description) → Task
  getTasks() → Array<Task>
  getTaskById(id) → Task | null
  updateTask(id, updates) → Task | null
  deleteTask(id) → boolean
  toggleTask(id) → Task | null
}
```

### 8.2 StorageManager モジュール
```javascript
class StorageManager {
  constructor(storageKey)
  save(data) → void
  load() → Object | null
  clear() → void
}
```

### 8.3 UIUpdater モジュール
```javascript
class UIUpdater {
  constructor(containerSelector)
  renderTasks(tasks) → void
  addTaskCard(task) → void
  updateTaskCard(task) → void
  removeTaskCard(taskId) → void
  clearForm() → void
  showModal(task) → void
  hideModal() → void
  showConfirmDialog(taskId) → Promise<boolean>
}
```

### 8.4 Validator モジュール
```javascript
class Validator {
  validateTitle(title) → { valid: boolean, error: string }
  validateDescription(description) → { valid: boolean, error: string }
  sanitize(input) → string
}
```

## 9. エラーハンドリング設計

### 9.1 エラーケース
1. **LocalStorage容量不足**
   - エラーメッセージを表示
   - 古いタスクを削除する提案

2. **データ破損**
   - バックアップから復元を試行
   - 失敗時はデータを初期化

3. **入力値エラー**
   - リアルタイムバリデーション
   - エラーメッセージを表示

4. **XSS対策**
   - 入力値のサニタイズ
   - innerHTMLではなくtextContentを使用

### 9.2 エラーハンドリング実装
```javascript
try {
  // 処理
} catch (error) {
  console.error('Error:', error);
  // ユーザーにエラーメッセージを表示
  UIUpdater.showError('エラーが発生しました。');
}
```

## 10. セキュリティ設計

### 10.1 XSS対策
- **入力値のサニタイズ**: HTMLエスケープ処理
- **DOM操作**: `textContent`を使用（`innerHTML`は使用しない）
- **データ保存**: JSON形式で保存し、シリアライズ時にエスケープ

### 10.2 入力値検証
- **タイトル**: 1-100文字、必須
- **説明**: 最大500文字、任意
- **文字種**: 改行、タブ文字を許可

## 11. パフォーマンス設計

### 11.1 最適化方針
- **DOM操作の最小化**: 変更されたタスクのみ更新
- **イベントデリゲーション**: イベントリスナーを親要素に設定
- **データ読み込み**: ページ読み込み時のみ全件読み込み

### 11.2 パフォーマンス目標
- タスク追加: < 100ms
- タスク更新: < 100ms
- タスク削除: < 100ms
- 一覧表示: < 500ms（100件の場合）

## 12. スタイル設計

### 12.1 デザイン方針
- **モダンなフラットデザイン**
- **カラースキーム**: 
  - プライマリ: #007bff（青）
  - セカンダリ: #6c757d（グレー）
  - 成功: #28a745（緑）
  - 危険: #dc3545（赤）
- **フォント**: システムフォント（sans-serif）
- **影**: 軽いシャドウで立体感

### 12.2 レスポンシブブレークポイント
- **スマートフォン**: < 576px
- **タブレット**: 576px - 768px
- **デスクトップ**: > 768px

## 13. ユーザビリティ設計

### 13.1 操作性
- **キーボードショートカット**: Enterキーでタスク追加
- **フォーカス管理**: タブナビゲーション対応
- **フィードバック**: 操作時に視覚的フィードバック

### 13.2 アクセシビリティ
- **ARIA属性**: 適切なラベルとロールを設定
- **キーボード操作**: 全機能をキーボードで操作可能
- **コントラスト**: WCAG AA基準に準拠

## 14. テスト設計

### 14.1 テスト方針
- **手動テスト**: 各機能の動作確認
- **ブラウザテスト**: Chrome、Firefox、Edgeで動作確認

### 14.2 テスト項目
1. タスク追加機能
2. タスク一覧表示機能
3. タスク完了状態変更機能
4. タスク編集機能
5. タスク削除機能
6. データ永続化機能
7. エラーハンドリング
8. レスポンシブデザイン

---

**作成日**: 2025-01-XX
**バージョン**: 1.0
**ステータス**: ドラフト

