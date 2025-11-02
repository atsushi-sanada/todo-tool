/**
 * Validator - 入力値の検証とサニタイズを管理するクラス
 * 
 * タスクのタイトルと説明のバリデーション、XSS対策のサニタイズ機能を提供します。
 */
class Validator {
  // 定数定義
  static TITLE_MIN_LENGTH = 1;
  static TITLE_MAX_LENGTH = 100;
  static DESCRIPTION_MAX_LENGTH = 500;

  /**
   * タイトルのバリデーション
   * @param {string} title - 検証するタイトル
   * @returns {{valid: boolean, error: string}} 検証結果とエラーメッセージ
   */
  validateTitle(title) {
    // 未定義またはnullチェック
    if (title === undefined || title === null) {
      return {
        valid: false,
        error: 'タイトルは必須です。'
      };
    }

    // 文字列に変換
    const titleStr = String(title);

    // 空文字チェック（空白のみも不可）
    if (titleStr.trim().length === 0) {
      return {
        valid: false,
        error: 'タイトルは必須です。'
      };
    }

    // 文字数チェック
    if (titleStr.length < Validator.TITLE_MIN_LENGTH) {
      return {
        valid: false,
        error: `タイトルは${Validator.TITLE_MIN_LENGTH}文字以上である必要があります。`
      };
    }

    if (titleStr.length > Validator.TITLE_MAX_LENGTH) {
      return {
        valid: false,
        error: `タイトルは${Validator.TITLE_MAX_LENGTH}文字以内である必要があります。`
      };
    }

    return {
      valid: true,
      error: ''
    };
  }

  /**
   * 説明のバリデーション
   * @param {string} description - 検証する説明（任意）
   * @returns {{valid: boolean, error: string}} 検証結果とエラーメッセージ
   */
  validateDescription(description) {
    // 未定義、null、空文字列の場合は有効（任意項目のため）
    if (description === undefined || description === null || description === '') {
      return {
        valid: true,
        error: ''
      };
    }

    // 文字列に変換
    const descriptionStr = String(description);

    // 文字数チェック
    if (descriptionStr.length > Validator.DESCRIPTION_MAX_LENGTH) {
      return {
        valid: false,
        error: `説明は${Validator.DESCRIPTION_MAX_LENGTH}文字以内である必要があります。`
      };
    }

    return {
      valid: true,
      error: ''
    };
  }

  /**
   * 入力値のサニタイズ（XSS対策）
   * HTMLエスケープ処理を実行します。
   * 
   * @param {string} input - サニタイズする入力値
   * @returns {string} サニタイズされた文字列
   */
  sanitize(input) {
    if (input === undefined || input === null) {
      return '';
    }

    // 文字列に変換
    const inputStr = String(input);

    // HTMLエンティティのエスケープマップ
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    // エスケープ処理
    return inputStr.replace(/[&<>"'/]/g, (char) => {
      return escapeMap[char];
    });
  }

  /**
   * 入力値のサニタイズ（HTMLエスケープ不要の場合）
   * textContentで使用する場合は、このメソッドを使用します。
   * 改行やタブ文字は許可しますが、悪意のあるスクリプトはDOM操作で防ぎます。
   * 
   * @param {string} input - サニタイズする入力値
   * @returns {string} サニタイズされた文字列（改行・タブは保持）
   */
  sanitizeForTextContent(input) {
    if (input === undefined || input === null) {
      return '';
    }

    // 文字列に変換
    const inputStr = String(input);

    // textContentを使用する場合は、HTMLエスケープは不要
    // ただし、制御文字（NULなど）は除去
    return inputStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
}

// ES6モジュールとしてエクスポート
export default Validator;

