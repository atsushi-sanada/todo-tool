/**
 * StorageManager - LocalStorage操作を管理するクラス
 * 
 * LocalStorageへのデータ保存、読み込み、クリア機能を提供します。
 * エラーハンドリングも含まれています。
 */
class StorageManager {
  /**
   * コンストラクタ
   * @param {string} storageKey - LocalStorageに保存する際のキー名
   */
  constructor(storageKey = 'todo-app-data') {
    this.storageKey = storageKey;
  }

  /**
   * データをLocalStorageに保存する
   * @param {Object} data - 保存するデータオブジェクト
   * @throws {Error} LocalStorageへの保存に失敗した場合
   */
  save(data) {
    try {
      const jsonString = JSON.stringify(data);
      localStorage.setItem(this.storageKey, jsonString);
    } catch (error) {
      console.error('StorageManager.save: データの保存に失敗しました', error);
      
      // エラーの種類を判定
      if (error.name === 'QuotaExceededError') {
        throw new Error('ストレージ容量が不足しています。古いタスクを削除してください。');
      } else {
        throw new Error('データの保存に失敗しました。ブラウザのストレージ設定を確認してください。');
      }
    }
  }

  /**
   * LocalStorageからデータを読み込む
   * @returns {Object|null} 読み込んだデータオブジェクト。データが存在しない場合はnull
   */
  load() {
    try {
      const jsonString = localStorage.getItem(this.storageKey);
      
      if (jsonString === null) {
        return null;
      }

      const data = JSON.parse(jsonString);
      return data;
    } catch (error) {
      console.error('StorageManager.load: データの読み込みに失敗しました', error);
      
      // データが破損している可能性があるため、クリアしてnullを返す
      this.clear();
      return null;
    }
  }

  /**
   * LocalStorageからデータをクリアする
   */
  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('StorageManager.clear: データのクリアに失敗しました', error);
      throw new Error('データのクリアに失敗しました。');
    }
  }

  /**
   * LocalStorageが利用可能かどうかを確認する
   * @returns {boolean} LocalStorageが利用可能な場合true
   */
  static isAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ES6モジュールとしてエクスポート
export default StorageManager;

