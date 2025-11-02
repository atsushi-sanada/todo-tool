/**
 * UIUpdater - DOM操作とUI更新を管理するクラス
 * 
 * タスク一覧のレンダリング、タスクカードの追加・更新・削除、
 * モーダル・ダイアログの表示、フォームのクリアなどのUI操作を担当します。
 */
class UIUpdater {
  /**
   * コンストラクタ
   * @param {string} containerSelector - タスク一覧のコンテナセレクタ
   */
  constructor(containerSelector = '#taskList') {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      throw new Error(`コンテナ要素が見つかりません: ${containerSelector}`);
    }

    // DOM要素の参照をキャッシュ
    this.taskForm = document.querySelector('#taskForm');
    this.taskTitleInput = document.querySelector('#taskTitle');
    this.taskDescriptionInput = document.querySelector('#taskDescription');
    this.editModal = document.querySelector('#editModal');
    this.editForm = document.querySelector('#editForm');
    this.editTitleInput = document.querySelector('#editTitle');
    this.editDescriptionInput = document.querySelector('#editDescription');
    this.deleteDialog = document.querySelector('#deleteDialog');
    this.deleteDialogMessage = document.querySelector('#deleteDialogMessage');

    // 編集・削除対象のタスクIDを保存
    this.currentEditTaskId = null;
    this.currentDeleteTaskId = null;

    // モーダル表示時のフォーカス管理用
    this.focusedElementBeforeModal = null;
  }

  /**
   * 日付をフォーマットする
   * @param {string} isoString - ISO 8601形式の日時文字列
   * @returns {string} フォーマットされた日時文字列
   */
  formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'たった今' : `${minutes}分前`;
      }
      return `${hours}時間前`;
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * タスクカードのHTMLを生成する
   * @param {Object} task - タスクオブジェクト
   * @returns {string} タスクカードのHTML文字列
   */
  createTaskCardHTML(task) {
    const completedClass = task.completed ? 'completed' : '';
    const titleClass = task.completed ? 'task-title completed' : 'task-title';
    const titleStyle = task.completed ? 'text-decoration: line-through;' : '';

    return `
      <div class="task-card ${completedClass}" role="listitem" data-task-id="${task.id}">
        <div class="task-card-header">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="完了状態を切り替え" data-task-id="${task.id}">
          <h3 class="${titleClass}">${this.escapeHTML(task.title)}</h3>
        </div>
        ${task.description ? `<p class="task-description">${this.escapeHTML(task.description)}</p>` : ''}
        <div class="task-card-footer">
          <time class="task-date" datetime="${task.createdAt}">作成: ${this.formatDate(task.createdAt)}</time>
          ${task.updatedAt !== task.createdAt ? `<time class="task-date" datetime="${task.updatedAt}">更新: ${this.formatDate(task.updatedAt)}</time>` : ''}
          <div class="task-actions">
            <button class="btn btn-edit" aria-label="タスクを編集" data-task-id="${task.id}">編集</button>
            <button class="btn btn-delete" aria-label="タスクを削除" data-task-id="${task.id}">削除</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * HTMLエスケープ（XSS対策）
   * @param {string} text - エスケープするテキスト
   * @returns {string} エスケープされたテキスト
   */
  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * タスク一覧をレンダリングする
   * @param {Array<Object>} tasks - タスクの配列
   */
  renderTasks(tasks) {
    // 作成日時降順でソート
    const sortedTasks = [...tasks].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 既存のコンテンツをクリア
    this.container.innerHTML = '';

    // タスクがない場合のメッセージ
    if (sortedTasks.length === 0) {
      this.container.innerHTML = '<p class="text-center" style="padding: 40px; color: #6c757d;">タスクがありません。新しいタスクを追加してください。</p>';
      return;
    }

    // 各タスクカードを追加
    sortedTasks.forEach(task => {
      this.addTaskCard(task);
    });
  }

  /**
   * タスクカードを追加する
   * @param {Object} task - タスクオブジェクト
   */
  addTaskCard(task) {
    const taskCardHTML = this.createTaskCardHTML(task);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = taskCardHTML.trim();
    const taskCard = tempDiv.firstElementChild;

    this.container.appendChild(taskCard);
  }

  /**
   * タスクカードを更新する
   * @param {Object} task - 更新されたタスクオブジェクト
   */
  updateTaskCard(task) {
    const taskCard = this.container.querySelector(`[data-task-id="${task.id}"]`);
    if (!taskCard) {
      console.warn(`タスクカードが見つかりません: ${task.id}`);
      return;
    }

    // 新しいHTMLで置き換え
    const newTaskCardHTML = this.createTaskCardHTML(task);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newTaskCardHTML.trim();
    const newTaskCard = tempDiv.firstElementChild;

    taskCard.replaceWith(newTaskCard);
  }

  /**
   * タスクカードを削除する
   * @param {string} taskId - 削除するタスクのID
   */
  removeTaskCard(taskId) {
    const taskCard = this.container.querySelector(`[data-task-id="${taskId}"]`);
    if (taskCard) {
      taskCard.remove();
    }

    // タスクが0件になった場合のメッセージを表示
    if (this.container.children.length === 0) {
      this.container.innerHTML = '<p class="text-center" style="padding: 40px; color: #6c757d;">タスクがありません。新しいタスクを追加してください。</p>';
    }
  }

  /**
   * フォームをクリアする
   */
  clearForm() {
    if (this.taskTitleInput) {
      this.taskTitleInput.value = '';
    }
    if (this.taskDescriptionInput) {
      this.taskDescriptionInput.value = '';
    }
    // フォーカスをタイトル入力に戻す
    if (this.taskTitleInput) {
      this.taskTitleInput.focus();
    }
  }

  /**
   * 編集モーダルを表示する
   * @param {Object} task - 編集するタスクオブジェクト
   */
  showModal(task) {
    if (!this.editModal || !this.editTitleInput || !this.editDescriptionInput) {
      console.error('編集モーダルの要素が見つかりません');
      return;
    }

    this.currentEditTaskId = task.id;
    this.editTitleInput.value = task.title;
    this.editDescriptionInput.value = task.description || '';

    // 現在のフォーカス要素を保存
    this.focusedElementBeforeModal = document.activeElement;

    // モーダルを表示
    this.editModal.setAttribute('aria-hidden', 'false');
    this.editModal.style.display = 'flex';

    // フォーカスをモーダル内の最初の要素に移動
    this.editTitleInput.focus();

    // バックドロップクリックで閉じる
    const backdrop = this.editModal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', this.handleBackdropClick.bind(this));
    }

    // ESCキーで閉じる
    document.addEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  /**
   * モーダルを非表示にする
   */
  hideModal() {
    if (!this.editModal) {
      return;
    }

    this.editModal.setAttribute('aria-hidden', 'true');
    this.editModal.style.display = 'none';

    // フォーカスを元の要素に戻す
    if (this.focusedElementBeforeModal) {
      this.focusedElementBeforeModal.focus();
      this.focusedElementBeforeModal = null;
    }

    // 編集フォームをクリア
    if (this.editForm) {
      this.editForm.reset();
    }
    this.currentEditTaskId = null;

    // イベントリスナーを削除
    document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  /**
   * バックドロップクリックハンドラ
   * @param {Event} event - クリックイベント
   */
  handleBackdropClick(event) {
    if (event.target.classList.contains('modal-backdrop')) {
      this.hideModal();
    }
  }

  /**
   * ESCキーハンドラ
   * @param {Event} event - キーボードイベント
   */
  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      if (this.editModal && this.editModal.getAttribute('aria-hidden') === 'false') {
        this.hideModal();
      }
      if (this.deleteDialog && this.deleteDialog.getAttribute('aria-hidden') === 'false') {
        this.hideDialog();
      }
    }
  }

  /**
   * 削除確認ダイアログを表示する
   * @param {string} taskId - 削除するタスクのID
   * @param {string} taskTitle - タスクのタイトル（オプション）
   * @returns {Promise<boolean>} ユーザーが削除を確認した場合true
   */
  showConfirmDialog(taskId, taskTitle = '') {
    return new Promise((resolve) => {
      if (!this.deleteDialog || !this.deleteDialogMessage) {
        console.error('削除ダイアログの要素が見つかりません');
        resolve(false);
        return;
      }

      this.currentDeleteTaskId = taskId;

      // メッセージを設定
      const message = taskTitle 
        ? `「${this.escapeHTML(taskTitle)}」を削除してもよろしいですか？`
        : 'このタスクを削除してもよろしいですか？';
      this.deleteDialogMessage.textContent = message;

      // 現在のフォーカス要素を保存
      this.focusedElementBeforeModal = document.activeElement;

      // ダイアログを表示
      this.deleteDialog.setAttribute('aria-hidden', 'false');
      this.deleteDialog.style.display = 'flex';

      // フォーカスを削除ボタンに移動
      const confirmButton = this.deleteDialog.querySelector('#confirmDelete');
      if (confirmButton) {
        confirmButton.focus();
      }

      // 削除ボタンのイベントリスナー
      const handleConfirm = () => {
        this.hideDialog();
        resolve(true);
      };

      // キャンセルボタンのイベントリスナー
      const handleCancel = () => {
        this.hideDialog();
        resolve(false);
      };

      const confirmBtn = this.deleteDialog.querySelector('#confirmDelete');
      const cancelBtn = this.deleteDialog.querySelector('#cancelDelete');

      if (confirmBtn) {
        confirmBtn.onclick = handleConfirm;
      }
      if (cancelBtn) {
        cancelBtn.onclick = handleCancel;
      }

      // ESCキーで閉じる
      document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    });
  }

  /**
   * 削除確認ダイアログを非表示にする
   */
  hideDialog() {
    if (!this.deleteDialog) {
      return;
    }

    this.deleteDialog.setAttribute('aria-hidden', 'true');
    this.deleteDialog.style.display = 'none';

    // フォーカスを元の要素に戻す
    if (this.focusedElementBeforeModal) {
      this.focusedElementBeforeModal.focus();
      this.focusedElementBeforeModal = null;
    }

    this.currentDeleteTaskId = null;
  }

  /**
   * エラーメッセージを表示する
   * @param {string} message - エラーメッセージ
   */
  showError(message) {
    // 既存のエラーメッセージを削除
    const existingError = document.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    // エラーメッセージを作成
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.style.cssText = `
      background-color: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #f5c6cb;
      margin-bottom: 20px;
    `;
    errorDiv.textContent = message;

    // フォームセクションの前に挿入
    const formSection = document.querySelector('.task-form-section');
    if (formSection && formSection.parentNode) {
      formSection.parentNode.insertBefore(errorDiv, formSection);
    } else {
      // フォールバック: コンテナの最初に挿入
      if (this.container && this.container.parentNode) {
        this.container.parentNode.insertBefore(errorDiv, this.container);
      }
    }

    // 3秒後に自動削除
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 3000);
  }

  /**
   * 現在編集中のタスクIDを取得する
   * @returns {string|null} タスクID
   */
  getCurrentEditTaskId() {
    return this.currentEditTaskId;
  }

  /**
   * 現在削除対象のタスクIDを取得する
   * @returns {string|null} タスクID
   */
  getCurrentDeleteTaskId() {
    return this.currentDeleteTaskId;
  }
}

// ES6モジュールとしてエクスポート
export default UIUpdater;

