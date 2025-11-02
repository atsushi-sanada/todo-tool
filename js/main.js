/**
 * TODOアプリ - メインアプリケーション
 * 
 * 各モジュールを統合し、アプリケーション全体の動作を管理します。
 */

// モジュールのインポート
import StorageManager from './storageManager.js';
import Validator from './validator.js';
import TaskManager from './taskManager.js';
import UIUpdater from './uiUpdater.js';

/**
 * TODOアプリケーションクラス
 */
class TodoApp {
  constructor() {
    // モジュールの初期化
    this.storageManager = new StorageManager('todo-app-data');
    this.validator = new Validator();
    this.taskManager = new TaskManager(this.storageManager);
    this.uiUpdater = new UIUpdater('#taskList');

    // イベントハンドラーのバインド
    this.handleTaskFormSubmit = this.handleTaskFormSubmit.bind(this);
    this.handleTaskListClick = this.handleTaskListClick.bind(this);
    this.handleEditFormSubmit = this.handleEditFormSubmit.bind(this);
    this.handleCancelEdit = this.handleCancelEdit.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  /**
   * アプリケーションの初期化
   */
  init() {
    try {
      // LocalStorageが利用可能かチェック
      if (!StorageManager.isAvailable()) {
        this.showError('LocalStorageが利用できません。ブラウザの設定を確認してください。');
        return;
      }

      // イベントリスナーの設定
      this.setupEventListeners();

      // ページ読み込み時にタスク一覧を表示
      this.loadTasks();

      console.log('TODOアプリが初期化されました。');
    } catch (error) {
      console.error('アプリケーションの初期化に失敗しました:', error);
      this.showError('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // タスク追加フォーム
    const taskForm = document.querySelector('#taskForm');
    if (taskForm) {
      taskForm.addEventListener('submit', this.handleTaskFormSubmit);
    }

    // タスク一覧（イベントデリゲーション）
    const taskList = document.querySelector('#taskList');
    if (taskList) {
      taskList.addEventListener('click', this.handleTaskListClick);
    }

    // 編集フォーム
    const editForm = document.querySelector('#editForm');
    if (editForm) {
      editForm.addEventListener('submit', this.handleEditFormSubmit);
    }

    // キャンセルボタン
    const cancelEditBtn = document.querySelector('#cancelEdit');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', this.handleCancelEdit);
    }

    // モーダル閉じるボタン
    const modalCloseBtn = document.querySelector('.modal-close');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', this.handleModalClose);
    }
  }

  /**
   * タスク一覧を読み込んで表示する
   */
  loadTasks() {
    try {
      const tasks = this.taskManager.getTasks();
      this.uiUpdater.renderTasks(tasks);
    } catch (error) {
      console.error('タスクの読み込みに失敗しました:', error);
      this.showError('タスクの読み込みに失敗しました。');
    }
  }

  /**
   * タスク追加フォームのsubmitイベントハンドラ
   * @param {Event} event - イベントオブジェクト
   */
  async handleTaskFormSubmit(event) {
    event.preventDefault();

    try {
      const formData = new FormData(event.target);
      const title = formData.get('title') || '';
      const description = formData.get('description') || '';

      // バリデーション
      const titleValidation = this.validator.validateTitle(title);
      if (!titleValidation.valid) {
        this.showError(titleValidation.error);
        return;
      }

      const descriptionValidation = this.validator.validateDescription(description);
      if (!descriptionValidation.valid) {
        this.showError(descriptionValidation.error);
        return;
      }

      // サニタイズ
      const sanitizedTitle = this.validator.sanitize(title.trim());
      const sanitizedDescription = this.validator.sanitize(description.trim());

      // タスクを追加
      const newTask = this.taskManager.addTask(sanitizedTitle, sanitizedDescription);

      // UIを更新
      this.loadTasks();

      // フォームをクリア
      this.uiUpdater.clearForm();

      console.log('タスクを追加しました:', newTask);
    } catch (error) {
      console.error('タスクの追加に失敗しました:', error);
      this.showError(error.message || 'タスクの追加に失敗しました。');
    }
  }

  /**
   * タスク一覧のクリックイベントハンドラ（イベントデリゲーション）
   * @param {Event} event - イベントオブジェクト
   */
  async handleTaskListClick(event) {
    const target = event.target;
    const taskId = target.getAttribute('data-task-id');

    if (!taskId) {
      return;
    }

    try {
      // チェックボックスのクリック
      if (target.classList.contains('task-checkbox')) {
        await this.handleTaskToggle(taskId);
      }
      // 編集ボタンのクリック
      else if (target.classList.contains('btn-edit')) {
        await this.handleTaskEdit(taskId);
      }
      // 削除ボタンのクリック
      else if (target.classList.contains('btn-delete')) {
        await this.handleTaskDelete(taskId);
      }
    } catch (error) {
      console.error('タスク操作に失敗しました:', error);
      this.showError(error.message || 'タスク操作に失敗しました。');
    }
  }

  /**
   * タスクの完了状態を切り替える
   * @param {string} taskId - タスクID
   */
  async handleTaskToggle(taskId) {
    try {
      const updatedTask = this.taskManager.toggleTask(taskId);
      if (updatedTask) {
        this.uiUpdater.updateTaskCard(updatedTask);
        console.log('タスクの完了状態を変更しました:', updatedTask);
      }
    } catch (error) {
      console.error('タスクの完了状態変更に失敗しました:', error);
      throw error;
    }
  }

  /**
   * タスクの編集モーダルを表示する
   * @param {string} taskId - タスクID
   */
  async handleTaskEdit(taskId) {
    try {
      const task = this.taskManager.getTaskById(taskId);
      if (!task) {
        this.showError('タスクが見つかりません。');
        return;
      }

      this.uiUpdater.showModal(task);
    } catch (error) {
      console.error('タスクの取得に失敗しました:', error);
      this.showError('タスクの取得に失敗しました。');
    }
  }

  /**
   * タスクの削除確認ダイアログを表示する
   * @param {string} taskId - タスクID
   */
  async handleTaskDelete(taskId) {
    try {
      const task = this.taskManager.getTaskById(taskId);
      if (!task) {
        this.showError('タスクが見つかりません。');
        return;
      }

      // 確認ダイアログを表示
      const confirmed = await this.uiUpdater.showConfirmDialog(taskId, task.title);

      if (confirmed) {
        // タスクを削除
        const deleted = this.taskManager.deleteTask(taskId);
        if (deleted) {
          this.uiUpdater.removeTaskCard(taskId);
          console.log('タスクを削除しました:', taskId);
        } else {
          this.showError('タスクの削除に失敗しました。');
        }
      }
    } catch (error) {
      console.error('タスクの削除に失敗しました:', error);
      this.showError(error.message || 'タスクの削除に失敗しました。');
    }
  }

  /**
   * 編集フォームのsubmitイベントハンドラ
   * @param {Event} event - イベントオブジェクト
   */
  async handleEditFormSubmit(event) {
    event.preventDefault();

    try {
      const taskId = this.uiUpdater.getCurrentEditTaskId();
      if (!taskId) {
        this.showError('編集対象のタスクが見つかりません。');
        return;
      }

      const formData = new FormData(event.target);
      const title = formData.get('title') || '';
      const description = formData.get('description') || '';

      // バリデーション
      const titleValidation = this.validator.validateTitle(title);
      if (!titleValidation.valid) {
        this.showError(titleValidation.error);
        return;
      }

      const descriptionValidation = this.validator.validateDescription(description);
      if (!descriptionValidation.valid) {
        this.showError(descriptionValidation.error);
        return;
      }

      // サニタイズ
      const sanitizedTitle = this.validator.sanitize(title.trim());
      const sanitizedDescription = this.validator.sanitize(description.trim());

      // タスクを更新
      const updatedTask = this.taskManager.updateTask(taskId, {
        title: sanitizedTitle,
        description: sanitizedDescription
      });

      if (updatedTask) {
        // UIを更新
        this.uiUpdater.updateTaskCard(updatedTask);

        // モーダルを閉じる
        this.uiUpdater.hideModal();

        console.log('タスクを更新しました:', updatedTask);
      } else {
        this.showError('タスクの更新に失敗しました。');
      }
    } catch (error) {
      console.error('タスクの更新に失敗しました:', error);
      this.showError(error.message || 'タスクの更新に失敗しました。');
    }
  }

  /**
   * 編集キャンセルボタンのクリックイベントハンドラ
   */
  handleCancelEdit() {
    this.uiUpdater.hideModal();
  }

  /**
   * モーダル閉じるボタンのクリックイベントハンドラ
   */
  handleModalClose() {
    this.uiUpdater.hideModal();
  }

  /**
   * エラーメッセージを表示する
   * @param {string} message - エラーメッセージ
   */
  showError(message) {
    this.uiUpdater.showError(message);
  }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
  const app = new TodoApp();
  app.init();
});

