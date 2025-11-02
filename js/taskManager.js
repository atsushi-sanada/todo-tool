import StorageManager from './storageManager.js';

/**
 * TaskManager - タスクのCRUD操作を管理するクラス
 * 
 * タスクの追加、取得、更新、削除、完了状態の切り替えを管理します。
 * StorageManagerを使用してデータの永続化を行います。
 */
class TaskManager {
  /**
   * コンストラクタ
   * @param {StorageManager} storageManager - StorageManagerのインスタンス
   */
  constructor(storageManager) {
    if (!storageManager) {
      throw new Error('StorageManagerのインスタンスが必要です。');
    }
    this.storageManager = storageManager;
    this.dataVersion = '1.0.0';
  }

  /**
   * UUID v4を生成する
   * @returns {string} UUID v4形式の文字列
   */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 現在の日時をISO 8601形式で取得する
   * @returns {string} ISO 8601形式の日時文字列
   */
  static getCurrentISOString() {
    return new Date().toISOString();
  }

  /**
   * データを読み込む（内部メソッド）
   * @returns {Object} データオブジェクト
   */
  _loadData() {
    const data = this.storageManager.load();
    
    // データが存在しない場合は初期化
    if (data === null) {
      return {
        tasks: [],
        version: this.dataVersion
      };
    }

    // バージョンが異なる場合は初期化
    if (data.version !== this.dataVersion) {
      console.warn('データバージョンが異なります。データを初期化します。');
      return {
        tasks: [],
        version: this.dataVersion
      };
    }

    return data;
  }

  /**
   * データを保存する（内部メソッド）
   * @param {Object} data - 保存するデータオブジェクト
   */
  _saveData(data) {
    data.version = this.dataVersion;
    this.storageManager.save(data);
  }

  /**
   * タスクを追加する
   * @param {string} title - タスクのタイトル
   * @param {string} [description=''] - タスクの説明（任意）
   * @returns {Object} 作成されたタスクオブジェクト
   * @throws {Error} タイトルが空の場合
   */
  addTask(title, description = '') {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('タイトルは必須です。');
    }

    const now = TaskManager.getCurrentISOString();
    const task = {
      id: TaskManager.generateUUID(),
      title: title.trim(),
      description: description ? description.trim() : '',
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    const data = this._loadData();
    data.tasks.push(task);
    this._saveData(data);

    return task;
  }

  /**
   * 全てのタスクを取得する
   * @returns {Array<Object>} タスクの配列
   */
  getTasks() {
    const data = this._loadData();
    return [...data.tasks]; // コピーを返す
  }

  /**
   * IDでタスクを取得する
   * @param {string} id - タスクのID
   * @returns {Object|null} タスクオブジェクト。見つからない場合はnull
   */
  getTaskById(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const data = this._loadData();
    const task = data.tasks.find(t => t.id === id);
    
    return task ? { ...task } : null; // コピーを返す
  }

  /**
   * タスクを更新する
   * @param {string} id - タスクのID
   * @param {Object} updates - 更新するフィールド（title, description, completed）
   * @returns {Object|null} 更新されたタスクオブジェクト。見つからない場合はnull
   */
  updateTask(id, updates) {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const data = this._loadData();
    const taskIndex = data.tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
      return null;
    }

    const task = data.tasks[taskIndex];
    const now = TaskManager.getCurrentISOString();

    // 更新可能なフィールドのみ更新
    if (updates.title !== undefined) {
      task.title = String(updates.title).trim();
    }
    if (updates.description !== undefined) {
      task.description = String(updates.description).trim();
    }
    if (updates.completed !== undefined) {
      task.completed = Boolean(updates.completed);
    }

    task.updatedAt = now;

    this._saveData(data);

    return { ...task }; // コピーを返す
  }

  /**
   * タスクを削除する
   * @param {string} id - タスクのID
   * @returns {boolean} 削除に成功した場合true
   */
  deleteTask(id) {
    if (!id || typeof id !== 'string') {
      return false;
    }

    const data = this._loadData();
    const taskIndex = data.tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
      return false;
    }

    data.tasks.splice(taskIndex, 1);
    this._saveData(data);

    return true;
  }

  /**
   * タスクの完了状態を切り替える
   * @param {string} id - タスクのID
   * @returns {Object|null} 更新されたタスクオブジェクト。見つからない場合はnull
   */
  toggleTask(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const data = this._loadData();
    const task = data.tasks.find(t => t.id === id);

    if (!task) {
      return null;
    }

    const now = TaskManager.getCurrentISOString();
    task.completed = !task.completed;
    task.updatedAt = now;

    this._saveData(data);

    return { ...task }; // コピーを返す
  }
}

// ES6モジュールとしてエクスポート
export default TaskManager;

