'use strict';

const TOOL_TYPES = Object.freeze({
  SELECT: 'select',
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  NOTE: 'note',
  CONNECT: 'connect',
});

const NODE_TYPES = Object.freeze({
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  NOTE: 'note',
});

const STORAGE_KEY = 'diagram-board-state-v1';
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const MAX_HISTORY = 80;

/**
 * 指定範囲に数値を収めます。
 *
 * @param {number} value 対象値。
 * @param {number} min 最小値。
 * @param {number} max 最大値。
 * @returns {number} 範囲内に丸めた値。
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * JSON互換オブジェクトをディープコピーします。
 *
 * @param {Object} source コピー元。
 * @returns {Object} コピー結果。
 */
function deepClone(source) {
  return JSON.parse(JSON.stringify(source));
}

/**
 * SVG要素を生成して属性を付与します。
 *
 * @param {string} tagName タグ名。
 * @param {Object<string, string|number>} attributes 属性。
 * @returns {SVGElement} 生成したSVG要素。
 */
function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

/**
 * IDを生成します。
 *
 * @param {string} prefix IDのプレフィックス。
 * @returns {string} 一意のID。
 */
function createId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

/**
 * JSONファイルをダウンロードします。
 *
 * @param {string} fileName 出力ファイル名。
 * @param {string} content JSON文字列。
 */
function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * ノードデータを正規化します。
 *
 * @param {Object} node 未加工ノード。
 * @returns {Object} 正規化済みノード。
 */
function normalizeNode(node) {
  const safeLabel = typeof node.label === 'string' ? node.label : '';
  const safeType = Object.values(NODE_TYPES).includes(node.type)
    ? node.type
    : NODE_TYPES.RECTANGLE;

  return {
    id: typeof node.id === 'string' ? node.id : createId('node'),
    type: safeType,
    x: Number.isFinite(node.x) ? node.x : 0,
    y: Number.isFinite(node.y) ? node.y : 0,
    width: clamp(Number.isFinite(node.width) ? node.width : 160, 40, 900),
    height: clamp(Number.isFinite(node.height) ? node.height : 100, 30, 900),
    label: safeLabel.slice(0, 120),
    fill: typeof node.fill === 'string' ? node.fill : '#e2e8f0',
    stroke: typeof node.stroke === 'string' ? node.stroke : '#334155',
  };
}

/**
 * エッジデータを正規化します。
 *
 * @param {Object} edge 未加工エッジ。
 * @returns {Object} 正規化済みエッジ。
 */
function normalizeEdge(edge) {
  return {
    id: typeof edge.id === 'string' ? edge.id : createId('edge'),
    from: typeof edge.from === 'string' ? edge.from : '',
    to: typeof edge.to === 'string' ? edge.to : '',
  };
}

/**
 * ステート構造の妥当性を判定します。
 *
 * @param {Object} state 判定対象。
 * @returns {boolean} 妥当な場合はtrue。
 */
function isValidState(state) {
  return Boolean(
    state &&
      typeof state === 'object' &&
      Array.isArray(state.nodes) &&
      Array.isArray(state.edges),
  );
}

/**
 * ラベル文字列をサニタイズします。
 *
 * @param {string} value 入力文字列。
 * @returns {string} 整形済み文字列。
 */
function sanitizeLabel(value) {
  return value.replace(/\r/g, '').slice(0, 120);
}

/**
 * 図形ステートを管理するストアです。
 */
class DiagramStore {
  /**
   * @param {string} storageKey ローカルストレージキー。
   */
  constructor(storageKey) {
    this._storageKey = storageKey;
    this._state = { nodes: [], edges: [] };
    this._undoStack = [];
    this._redoStack = [];
  }

  /**
   * 現在のステート参照を返します。
   *
   * @returns {{nodes: Object[], edges: Object[]}} ステート。
   */
  getState() {
    return this._state;
  }

  /**
   * スナップショットを返します。
   *
   * @returns {{nodes: Object[], edges: Object[]}} ディープコピーしたステート。
   */
  snapshot() {
    return deepClone(this._state);
  }

  /**
   * LocalStorageからステートを読み込みます。
   *
   * @returns {boolean} 読み込み成功時はtrue。
   */
  load() {
    try {
      const rawData = localStorage.getItem(this._storageKey);
      if (!rawData) {
        return false;
      }

      const parsed = JSON.parse(rawData);
      const candidate = parsed?.state ?? parsed;
      if (!isValidState(candidate)) {
        throw new Error('Invalid state format.');
      }

      this._state = {
        nodes: candidate.nodes.map((node) => normalizeNode(node)),
        edges: candidate.edges.map((edge) => normalizeEdge(edge)),
      };

      this._cleanupInvalidEdges();
      this._undoStack = [];
      this._redoStack = [];
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * LocalStorageへステートを書き込みます。
   *
   * @returns {boolean} 保存成功時はtrue。
   */
  save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this._state));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * 新しいステートを反映します。
   *
   * @param {Object} nextState 新しいステート。
   * @returns {boolean} 成功時はtrue。
   */
  replaceState(nextState) {
    if (!isValidState(nextState)) {
      return false;
    }

    const beforeState = this.snapshot();
    this._state = {
      nodes: nextState.nodes.map((node) => normalizeNode(node)),
      edges: nextState.edges.map((edge) => normalizeEdge(edge)),
    };
    this._cleanupInvalidEdges();
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * 空のステートへ初期化します。
   *
   * @returns {boolean} 成功時はtrue。
   */
  clear() {
    const beforeState = this.snapshot();
    this._state = { nodes: [], edges: [] };
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * ノードを取得します。
   *
   * @param {string} nodeId ノードID。
   * @returns {Object|null} 見つかったノード。
   */
  getNodeById(nodeId) {
    return this._state.nodes.find((node) => node.id === nodeId) || null;
  }

  /**
   * エッジを取得します。
   *
   * @param {string} edgeId エッジID。
   * @returns {Object|null} 見つかったエッジ。
   */
  getEdgeById(edgeId) {
    return this._state.edges.find((edge) => edge.id === edgeId) || null;
  }

  /**
   * ノードを追加します。
   *
   * @param {Object} node ノードデータ。
   * @returns {boolean} 成功時はtrue。
   */
  addNode(node) {
    const normalized = normalizeNode(node);
    const beforeState = this.snapshot();
    this._state.nodes.push(normalized);
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * ノードを更新します。
   *
   * @param {string} nodeId ノードID。
   * @param {Object} patch 変更内容。
   * @returns {boolean} 成功時はtrue。
   */
  updateNode(nodeId, patch) {
    const targetNode = this.getNodeById(nodeId);
    if (!targetNode) {
      return false;
    }

    const beforeState = this.snapshot();
    const nextNode = normalizeNode({ ...targetNode, ...patch, id: targetNode.id });
    Object.assign(targetNode, nextNode);
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * ドラッグ中に履歴追加なしで位置を更新します。
   *
   * @param {string} nodeId ノードID。
   * @param {number} x X座標。
   * @param {number} y Y座標。
   * @returns {boolean} 更新できた場合はtrue。
   */
  moveNode(nodeId, x, y) {
    const targetNode = this.getNodeById(nodeId);
    if (!targetNode) {
      return false;
    }

    targetNode.x = x;
    targetNode.y = y;
    return true;
  }

  /**
   * ノードを削除します。関連エッジも同時に削除します。
   *
   * @param {string} nodeId ノードID。
   * @returns {boolean} 成功時はtrue。
   */
  deleteNode(nodeId) {
    if (!this.getNodeById(nodeId)) {
      return false;
    }

    const beforeState = this.snapshot();
    this._state.nodes = this._state.nodes.filter((node) => node.id !== nodeId);
    this._state.edges = this._state.edges.filter(
      (edge) => edge.from !== nodeId && edge.to !== nodeId,
    );
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * エッジを追加します。
   *
   * @param {Object} edge エッジデータ。
   * @returns {boolean} 成功時はtrue。
   */
  addEdge(edge) {
    const normalized = normalizeEdge(edge);
    if (!normalized.from || !normalized.to || normalized.from === normalized.to) {
      return false;
    }

    const sourceNode = this.getNodeById(normalized.from);
    const targetNode = this.getNodeById(normalized.to);
    if (!sourceNode || !targetNode) {
      return false;
    }

    const duplicated = this._state.edges.some(
      (item) => item.from === normalized.from && item.to === normalized.to,
    );
    if (duplicated) {
      return false;
    }

    const beforeState = this.snapshot();
    this._state.edges.push(normalized);
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * エッジを削除します。
   *
   * @param {string} edgeId エッジID。
   * @returns {boolean} 成功時はtrue。
   */
  deleteEdge(edgeId) {
    if (!this.getEdgeById(edgeId)) {
      return false;
    }

    const beforeState = this.snapshot();
    this._state.edges = this._state.edges.filter((edge) => edge.id !== edgeId);
    return this.commitFromSnapshot(beforeState);
  }

  /**
   * 履歴スナップショットからコミットします。
   *
   * @param {Object} beforeState 操作前ステート。
   * @returns {boolean} 差分がありコミットできた場合はtrue。
   */
  commitFromSnapshot(beforeState) {
    if (JSON.stringify(beforeState) === JSON.stringify(this._state)) {
      return false;
    }

    this._undoStack.push(beforeState);
    if (this._undoStack.length > MAX_HISTORY) {
      this._undoStack.shift();
    }

    this._redoStack = [];
    this.save();
    return true;
  }

  /**
   * 元に戻します。
   *
   * @returns {boolean} 実行できた場合はtrue。
   */
  undo() {
    if (this._undoStack.length === 0) {
      return false;
    }

    const currentState = this.snapshot();
    const previousState = this._undoStack.pop();
    this._redoStack.push(currentState);
    this._state = previousState;
    this.save();
    return true;
  }

  /**
   * やり直します。
   *
   * @returns {boolean} 実行できた場合はtrue。
   */
  redo() {
    if (this._redoStack.length === 0) {
      return false;
    }

    const currentState = this.snapshot();
    const nextState = this._redoStack.pop();
    this._undoStack.push(currentState);
    this._state = nextState;
    this.save();
    return true;
  }

  /**
   * 孤立エッジを除去します。
   */
  _cleanupInvalidEdges() {
    const nodeIdSet = new Set(this._state.nodes.map((node) => node.id));
    this._state.edges = this._state.edges.filter(
      (edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to) && edge.from !== edge.to,
    );
  }
}

/**
 * 図表エディタ本体です。
 */
class DiagramApp {
  constructor() {
    this.store = new DiagramStore(STORAGE_KEY);
    this.currentTool = TOOL_TYPES.SELECT;
    this.selection = { kind: null, id: null };
    this.connectSourceNodeId = null;
    this.spacePressed = false;

    this.viewport = {
      x: 0,
      y: 0,
      scale: 1,
    };

    this.dragState = null;
    this.panState = null;
    this.toastTimer = null;
    this.renderQueued = false;

    this.dom = {};
  }

  /**
   * アプリを初期化します。
   */
  initialize() {
    this._cacheDom();
    this._bindEvents();

    const hasSavedData = this.store.load();
    if (hasSavedData) {
      this._showToast('保存済みデータを読み込みました。');
    }

    this._updateStatus('準備完了');
    this._updateToolButtons();
    this._updateCanvasCursor();
    this._render();
  }

  /**
   * DOM参照を保持します。
   */
  _cacheDom() {
    this.dom.svg = document.querySelector('#diagramSvg');
    this.dom.viewportGroup = document.querySelector('#viewportGroup');
    this.dom.nodeLayer = document.querySelector('#nodeLayer');
    this.dom.edgeLayer = document.querySelector('#edgeLayer');
    this.dom.statusText = document.querySelector('#statusText');
    this.dom.zoomRange = document.querySelector('#zoomRange');
    this.dom.zoomLabel = document.querySelector('#zoomLabel');
    this.dom.toast = document.querySelector('#toast');
    this.dom.toolButtons = Array.from(document.querySelectorAll('#toolButtonGroup [data-tool]'));
    this.dom.selectionInfo = document.querySelector('#selectionInfo');
    this.dom.propertiesForm = document.querySelector('#propertiesForm');
    this.dom.propLabel = document.querySelector('#propLabel');
    this.dom.propX = document.querySelector('#propX');
    this.dom.propY = document.querySelector('#propY');
    this.dom.propWidth = document.querySelector('#propWidth');
    this.dom.propHeight = document.querySelector('#propHeight');
    this.dom.propFill = document.querySelector('#propFill');
    this.dom.propStroke = document.querySelector('#propStroke');
    this.dom.applyPropertiesButton = document.querySelector('#applyPropertiesButton');
    this.dom.newBoardButton = document.querySelector('#newBoardButton');
    this.dom.saveButton = document.querySelector('#saveButton');
    this.dom.loadButton = document.querySelector('#loadButton');
    this.dom.exportJsonButton = document.querySelector('#exportJsonButton');
    this.dom.exportPngButton = document.querySelector('#exportPngButton');
    this.dom.importFileInput = document.querySelector('#importFileInput');
    this.dom.resetViewButton = document.querySelector('#resetViewButton');
  }

  /**
   * イベントを登録します。
   */
  _bindEvents() {
    this.dom.toolButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const toolType = button.dataset.tool;
        if (!toolType) {
          return;
        }

        this._setTool(toolType);
      });
    });

    this.dom.svg.addEventListener('pointerdown', (event) => this._onPointerDown(event));
    this.dom.svg.addEventListener('pointermove', (event) => this._onPointerMove(event));
    this.dom.svg.addEventListener('pointerup', (event) => this._onPointerUp(event));
    this.dom.svg.addEventListener('pointercancel', (event) => this._onPointerUp(event));
    this.dom.svg.addEventListener('wheel', (event) => this._onWheel(event), { passive: false });
    this.dom.svg.addEventListener('contextmenu', (event) => event.preventDefault());

    this.dom.propertiesForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this._applyProperties();
    });

    this.dom.zoomRange.addEventListener('input', () => {
      const percent = Number.parseInt(this.dom.zoomRange.value, 10);
      if (!Number.isFinite(percent)) {
        return;
      }

      const rect = this.dom.svg.getBoundingClientRect();
      this._setZoom(percent / 100, {
        x: rect.width / 2,
        y: rect.height / 2,
      });
    });

    this.dom.resetViewButton.addEventListener('click', () => {
      this.viewport = { x: 0, y: 0, scale: 1 };
      this._updateZoomUi();
      this._queueRender();
      this._updateStatus('ビューを初期化しました。');
    });

    this.dom.newBoardButton.addEventListener('click', () => this._createNewBoard());
    this.dom.saveButton.addEventListener('click', () => this._saveBoard());
    this.dom.loadButton.addEventListener('click', () => this.dom.importFileInput.click());
    this.dom.exportJsonButton.addEventListener('click', () => this._exportJson());
    this.dom.exportPngButton.addEventListener('click', () => this._exportPng());

    this.dom.importFileInput.addEventListener('change', async () => {
      if (!this.dom.importFileInput.files?.length) {
        return;
      }

      await this._importJsonFile(this.dom.importFileInput.files[0]);
      this.dom.importFileInput.value = '';
    });

    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    window.addEventListener('keyup', (event) => this._onKeyUp(event));
  }

  /**
   * ツールを切り替えます。
   *
   * @param {string} toolType ツール種別。
   */
  _setTool(toolType) {
    if (!Object.values(TOOL_TYPES).includes(toolType)) {
      return;
    }

    this.currentTool = toolType;
    this.connectSourceNodeId = null;
    this._updateToolButtons();
    this._updateCanvasCursor();
    this._updateStatus(`${this._formatToolName(toolType)}ツールに切り替えました。`);
    this._queueRender();
  }

  /**
   * ツールボタン表示を更新します。
   */
  _updateToolButtons() {
    this.dom.toolButtons.forEach((button) => {
      const toolType = button.dataset.tool;
      button.classList.toggle('is-active', toolType === this.currentTool);
    });
  }

  /**
   * キャンバスカーソルを更新します。
   */
  _updateCanvasCursor() {
    if (this.panState) {
      this.dom.svg.classList.add('is-panning');
      this.dom.svg.style.cursor = 'grabbing';
      return;
    }

    this.dom.svg.classList.remove('is-panning');
    if (this.currentTool === TOOL_TYPES.SELECT) {
      this.dom.svg.style.cursor = 'default';
      return;
    }

    if (this.currentTool === TOOL_TYPES.CONNECT) {
      this.dom.svg.style.cursor = 'crosshair';
      return;
    }

    this.dom.svg.style.cursor = 'copy';
  }

  /**
   * ポインターダウンを処理します。
   *
   * @param {PointerEvent} event ポインターイベント。
   */
  _onPointerDown(event) {
    const nodeElement = event.target.closest('.diagram-node');
    const edgeElement = event.target.closest('.diagram-edge');
    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;
      if (!nodeId) {
        return;
      }

      this._handleNodePointerDown(event, nodeId);
      return;
    }

    if (edgeElement) {
      const edgeId = edgeElement.dataset.edgeId;
      if (!edgeId) {
        return;
      }

      this._handleEdgePointerDown(event, edgeId);
      return;
    }

    this._handleCanvasPointerDown(event);
  }

  /**
   * ノード上のポインターダウンを処理します。
   *
   * @param {PointerEvent} event ポインターイベント。
   * @param {string} nodeId ノードID。
   */
  _handleNodePointerDown(event, nodeId) {
    if (this.currentTool === TOOL_TYPES.CONNECT) {
      this._connectNode(nodeId);
      return;
    }

    this._setSelection('node', nodeId);
    if (this.currentTool !== TOOL_TYPES.SELECT || event.button !== 0) {
      return;
    }

    const node = this.store.getNodeById(nodeId);
    if (!node) {
      return;
    }

    const worldPoint = this._clientToWorld(event.clientX, event.clientY);
    this.dragState = {
      pointerId: event.pointerId,
      nodeId,
      startPointer: worldPoint,
      nodeOrigin: { x: node.x, y: node.y },
      beforeState: this.store.snapshot(),
      moved: false,
    };

    this.dom.svg.setPointerCapture(event.pointerId);
  }

  /**
   * エッジ上のポインターダウンを処理します。
   *
   * @param {PointerEvent} event ポインターイベント。
   * @param {string} edgeId エッジID。
   */
  _handleEdgePointerDown(event, edgeId) {
    if (event.button !== 0) {
      return;
    }

    if (this.currentTool === TOOL_TYPES.CONNECT) {
      return;
    }

    this.connectSourceNodeId = null;
    this._setSelection('edge', edgeId);
  }

  /**
   * キャンバス上のポインターダウンを処理します。
   *
   * @param {PointerEvent} event ポインターイベント。
   */
  _handleCanvasPointerDown(event) {
    const shouldStartPan = event.button === 1 || (event.button === 0 && this.spacePressed);
    if (shouldStartPan) {
      this.panState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: this.viewport.x,
        originY: this.viewport.y,
      };

      this.dom.svg.setPointerCapture(event.pointerId);
      this._updateCanvasCursor();
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const worldPoint = this._clientToWorld(event.clientX, event.clientY);
    if (this.currentTool === TOOL_TYPES.SELECT) {
      this.connectSourceNodeId = null;
      this._setSelection(null, null);
      this._updateStatus('選択を解除しました。');
      this._queueRender();
      return;
    }

    if (this.currentTool === TOOL_TYPES.CONNECT) {
      this.connectSourceNodeId = null;
      this._updateStatus('接続元ノードを選択してください。');
      this._queueRender();
      return;
    }

    const newNode = this._createNodeByTool(this.currentTool, worldPoint.x, worldPoint.y);
    const added = this.store.addNode(newNode);
    if (!added) {
      this._showToast('ノード追加に失敗しました。', true);
      return;
    }

    this._setSelection('node', newNode.id);
    this._updateStatus(`${this._formatNodeType(newNode.type)}を追加しました。`);
    this._queueRender();
  }

  /**
   * ポインタームーブを処理します。
   *
   * @param {PointerEvent} event ポインターイベント。
   */
  _onPointerMove(event) {
    if (this.dragState && this.dragState.pointerId === event.pointerId) {
      const pointerWorld = this._clientToWorld(event.clientX, event.clientY);
      const deltaX = pointerWorld.x - this.dragState.startPointer.x;
      const deltaY = pointerWorld.y - this.dragState.startPointer.y;
      const nextX = this.dragState.nodeOrigin.x + deltaX;
      const nextY = this.dragState.nodeOrigin.y + deltaY;

      if (Math.abs(deltaX) > 0.2 || Math.abs(deltaY) > 0.2) {
        this.dragState.moved = true;
      }

      this.store.moveNode(this.dragState.nodeId, nextX, nextY);
      this._queueRender();
      return;
    }

    if (this.panState && this.panState.pointerId === event.pointerId) {
      const deltaX = event.clientX - this.panState.startClientX;
      const deltaY = event.clientY - this.panState.startClientY;
      this.viewport.x = this.panState.originX + deltaX;
      this.viewport.y = this.panState.originY + deltaY;
      this._queueRender();
    }
  }

  /**
   * ポインターアップを処理します。
   *
   * @param {PointerEvent} event ポインターイベント。
   */
  _onPointerUp(event) {
    if (this.dragState && this.dragState.pointerId === event.pointerId) {
      this.dom.svg.releasePointerCapture(event.pointerId);
      if (this.dragState.moved) {
        this.store.commitFromSnapshot(this.dragState.beforeState);
      } else {
        this.store.replaceState(this.dragState.beforeState);
      }

      this.dragState = null;
      this._queueRender();
      return;
    }

    if (this.panState && this.panState.pointerId === event.pointerId) {
      this.dom.svg.releasePointerCapture(event.pointerId);
      this.panState = null;
      this._updateCanvasCursor();
    }
  }

  /**
   * マウスホイールによるズームを処理します。
   *
   * @param {WheelEvent} event ホイールイベント。
   */
  _onWheel(event) {
    event.preventDefault();
    const deltaScale = event.deltaY < 0 ? 1.08 : 0.92;
    const nextScale = this.viewport.scale * deltaScale;

    const svgRect = this.dom.svg.getBoundingClientRect();
    const anchorPoint = {
      x: event.clientX - svgRect.left,
      y: event.clientY - svgRect.top,
    };

    this._setZoom(nextScale, anchorPoint);
  }

  /**
   * ズーム率を設定します。
   *
   * @param {number} nextScale 次のズーム率。
   * @param {{x: number, y: number}} anchorPoint キャンバス内アンカー座標。
   */
  _setZoom(nextScale, anchorPoint) {
    const clampedScale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(clampedScale - this.viewport.scale) < 0.0001) {
      return;
    }

    if (anchorPoint) {
      const worldX = (anchorPoint.x - this.viewport.x) / this.viewport.scale;
      const worldY = (anchorPoint.y - this.viewport.y) / this.viewport.scale;
      this.viewport.x = anchorPoint.x - worldX * clampedScale;
      this.viewport.y = anchorPoint.y - worldY * clampedScale;
    }

    this.viewport.scale = clampedScale;
    this._updateZoomUi();
    this._queueRender();
  }

  /**
   * 2点を接続します。
   *
   * @param {string} nodeId ノードID。
   */
  _connectNode(nodeId) {
    if (!this.connectSourceNodeId) {
      this.connectSourceNodeId = nodeId;
      this._setSelection('node', nodeId);
      this._updateStatus('接続先ノードをクリックしてください。');
      this._queueRender();
      return;
    }

    if (this.connectSourceNodeId === nodeId) {
      this.connectSourceNodeId = null;
      this._updateStatus('同じノードには接続できません。');
      this._queueRender();
      return;
    }

    const newEdge = {
      id: createId('edge'),
      from: this.connectSourceNodeId,
      to: nodeId,
    };
    const added = this.store.addEdge(newEdge);
    if (!added) {
      this._showToast('接続の作成に失敗しました。重複を確認してください。', true);
      return;
    }

    this.connectSourceNodeId = null;
    this._setSelection('edge', newEdge.id);
    this._updateStatus('ノードを接続しました。');
    this._queueRender();
  }

  /**
   * ノード作成データを返します。
   *
   * @param {string} toolType ツール種別。
   * @param {number} x X座標。
   * @param {number} y Y座標。
   * @returns {Object} ノードデータ。
   */
  _createNodeByTool(toolType, x, y) {
    const baseNode = {
      id: createId('node'),
      x,
      y,
      width: 160,
      height: 100,
      label: '新しい要素',
      fill: '#e2e8f0',
      stroke: '#334155',
      type: NODE_TYPES.RECTANGLE,
    };

    if (toolType === TOOL_TYPES.RECTANGLE) {
      return {
        ...baseNode,
        type: NODE_TYPES.RECTANGLE,
        label: '四角形',
        fill: '#dbeafe',
        stroke: '#1e3a8a',
      };
    }

    if (toolType === TOOL_TYPES.ELLIPSE) {
      return {
        ...baseNode,
        type: NODE_TYPES.ELLIPSE,
        width: 140,
        height: 140,
        label: '円',
        fill: '#dcfce7',
        stroke: '#166534',
      };
    }

    return {
      ...baseNode,
      type: NODE_TYPES.NOTE,
      width: 190,
      height: 120,
      label: 'ノート',
      fill: '#fef3c7',
      stroke: '#b45309',
    };
  }

  /**
   * プロパティフォームの内容を適用します。
   */
  _applyProperties() {
    if (this.selection.kind !== 'node' || !this.selection.id) {
      return;
    }

    const targetNode = this.store.getNodeById(this.selection.id);
    if (!targetNode) {
      return;
    }

    const nextX = Number.parseFloat(this.dom.propX.value);
    const nextY = Number.parseFloat(this.dom.propY.value);
    const nextWidth = Number.parseFloat(this.dom.propWidth.value);
    const nextHeight = Number.parseFloat(this.dom.propHeight.value);

    const patch = {
      label: sanitizeLabel(this.dom.propLabel.value),
      x: Number.isFinite(nextX) ? nextX : targetNode.x,
      y: Number.isFinite(nextY) ? nextY : targetNode.y,
      width: Number.isFinite(nextWidth) ? nextWidth : targetNode.width,
      height: Number.isFinite(nextHeight) ? nextHeight : targetNode.height,
      fill: this.dom.propFill.value || targetNode.fill,
      stroke: this.dom.propStroke.value || targetNode.stroke,
    };

    const updated = this.store.updateNode(targetNode.id, patch);
    if (!updated) {
      this._showToast('プロパティ更新に失敗しました。', true);
      return;
    }

    this._updateStatus('プロパティを反映しました。');
    this._queueRender();
  }

  /**
   * 新規ボードを作成します。
   */
  _createNewBoard() {
    const shouldClear = window.confirm('現在の図をクリアして新規ボードを作成します。');
    if (!shouldClear) {
      return;
    }

    this.store.clear();
    this.selection = { kind: null, id: null };
    this.connectSourceNodeId = null;
    this.viewport = { x: 0, y: 0, scale: 1 };
    this._updateZoomUi();
    this._updateStatus('新規ボードを作成しました。');
    this._queueRender();
  }

  /**
   * ローカルストレージへ保存します。
   */
  _saveBoard() {
    const saved = this.store.save();
    if (!saved) {
      this._showToast('保存に失敗しました。ブラウザ容量を確認してください。', true);
      return;
    }

    this._showToast('ローカルへ保存しました。');
    this._updateStatus('保存完了');
  }

  /**
   * JSONとして書き出します。
   */
  _exportJson() {
    const payload = {
      app: 'diagram-board',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: this.store.snapshot(),
    };

    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(now.getDate()).padStart(2, '0')}`;
    downloadTextFile(`diagram_board_${yyyymmdd}.json`, JSON.stringify(payload, null, 2));
    this._updateStatus('JSONを出力しました。');
  }

  /**
   * JSONファイルを読み込みます。
   *
   * @param {File} file インポート対象ファイル。
   */
  async _importJsonFile(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const candidate = parsed?.state ?? parsed;
      if (!isValidState(candidate)) {
        throw new Error('JSON形式が不正です。');
      }

      this.store.replaceState(candidate);
      this.selection = { kind: null, id: null };
      this.connectSourceNodeId = null;
      this._queueRender();
      this._showToast('JSONを読み込みました。');
      this._updateStatus('インポート完了');
    } catch (error) {
      console.error(error);
      this._showToast('JSONの読み込みに失敗しました。', true);
    }
  }

  /**
   * PNGとして書き出します。
   */
  _exportPng() {
    const svgElement = this.dom.svg.cloneNode(true);
    const serializer = new XMLSerializer();
    const svgRect = this.dom.svg.getBoundingClientRect();
    const width = Math.max(1, Math.floor(svgRect.width));
    const height = Math.max(1, Math.floor(svgRect.height));

    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('width', String(width));
    svgElement.setAttribute('height', String(height));

    const svgText = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        this._showToast('PNG出力に失敗しました。', true);
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        if (!blob) {
          this._showToast('PNG生成に失敗しました。', true);
          return;
        }

        const pngUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = pngUrl;
        anchor.download = 'diagram_board.png';
        anchor.click();
        URL.revokeObjectURL(pngUrl);
        this._updateStatus('PNGを出力しました。');
      }, 'image/png');
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      this._showToast('PNG出力に失敗しました。', true);
    };
    image.src = svgUrl;
  }

  /**
   * キーボードイベントを処理します。
   *
   * @param {KeyboardEvent} event キーボードイベント。
   */
  _onKeyDown(event) {
    if (event.key === ' ') {
      this.spacePressed = true;
      return;
    }

    const isInputTarget = this._isInputTarget(event.target);
    const withMeta = event.ctrlKey || event.metaKey;

    if (withMeta && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this._saveBoard();
      return;
    }

    if (withMeta && event.key.toLowerCase() === 'z') {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      const changed = this.store.undo();
      if (!changed) {
        this._showToast('これ以上戻せません。', true);
        return;
      }

      this.connectSourceNodeId = null;
      this._queueRender();
      this._updateStatus('元に戻しました。');
      return;
    }

    const isRedo =
      (withMeta && event.key.toLowerCase() === 'y') ||
      (withMeta && event.shiftKey && event.key.toLowerCase() === 'z');
    if (isRedo) {
      if (isInputTarget) {
        return;
      }

      event.preventDefault();
      const changed = this.store.redo();
      if (!changed) {
        this._showToast('これ以上やり直せません。', true);
        return;
      }

      this.connectSourceNodeId = null;
      this._queueRender();
      this._updateStatus('やり直しました。');
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && !isInputTarget) {
      event.preventDefault();
      this._deleteSelection();
    }
  }

  /**
   * キーボードキーアップを処理します。
   *
   * @param {KeyboardEvent} event キーボードイベント。
   */
  _onKeyUp(event) {
    if (event.key === ' ') {
      this.spacePressed = false;
      this._updateCanvasCursor();
    }
  }

  /**
   * 選択要素を削除します。
   */
  _deleteSelection() {
    if (!this.selection.kind || !this.selection.id) {
      return;
    }

    let deleted = false;
    if (this.selection.kind === 'node') {
      deleted = this.store.deleteNode(this.selection.id);
    } else if (this.selection.kind === 'edge') {
      deleted = this.store.deleteEdge(this.selection.id);
    }

    if (!deleted) {
      this._showToast('削除に失敗しました。', true);
      return;
    }

    this.selection = { kind: null, id: null };
    this.connectSourceNodeId = null;
    this._queueRender();
    this._updateStatus('選択要素を削除しました。');
  }

  /**
   * 選択状態を更新します。
   *
   * @param {'node'|'edge'|null} kind 種別。
   * @param {string|null} id 対象ID。
   */
  _setSelection(kind, id) {
    this.selection = { kind, id };
    this._updatePropertiesPanel();
  }

  /**
   * レンダリングを予約します。
   */
  _queueRender() {
    if (this.renderQueued) {
      return;
    }

    this.renderQueued = true;
    window.requestAnimationFrame(() => {
      this.renderQueued = false;
      this._render();
    });
  }

  /**
   * 表示全体を再描画します。
   */
  _render() {
    const transformText = `translate(${this.viewport.x} ${this.viewport.y}) scale(${this.viewport.scale})`;
    this.dom.viewportGroup.setAttribute('transform', transformText);

    this._renderEdges();
    this._renderNodes();
    this._updatePropertiesPanel();
    this._updateZoomUi();
  }

  /**
   * ノードを描画します。
   */
  _renderNodes() {
    this.dom.nodeLayer.textContent = '';
    const state = this.store.getState();
    state.nodes.forEach((node) => {
      const nodeGroup = createSvgElement('g', {
        class: 'diagram-node',
        'data-node-id': node.id,
      });

      const shapeAttributes = {
        class: 'node-body',
        fill: node.fill,
        stroke: node.stroke,
        'stroke-width': 2,
      };

      let shape = null;
      if (node.type === NODE_TYPES.ELLIPSE) {
        shape = createSvgElement('ellipse', {
          ...shapeAttributes,
          cx: node.x,
          cy: node.y,
          rx: node.width / 2,
          ry: node.height / 2,
        });
      } else {
        shape = createSvgElement('rect', {
          ...shapeAttributes,
          x: node.x - node.width / 2,
          y: node.y - node.height / 2,
          width: node.width,
          height: node.height,
          rx: node.type === NODE_TYPES.NOTE ? 4 : 12,
          ry: node.type === NODE_TYPES.NOTE ? 4 : 12,
        });

        if (node.type === NODE_TYPES.NOTE) {
          shape.setAttribute('stroke-dasharray', '8 4');
        }
      }

      const labelElement = createSvgElement('text', {
        class: 'node-label',
        x: node.x,
        y: node.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      });
      this._applyMultiLineLabel(labelElement, node.label, node.x, node.y);

      nodeGroup.appendChild(shape);
      nodeGroup.appendChild(labelElement);

      if (this.selection.kind === 'node' && this.selection.id === node.id) {
        nodeGroup.classList.add('is-selected');
      }

      if (this.currentTool === TOOL_TYPES.CONNECT && this.connectSourceNodeId === node.id) {
        nodeGroup.classList.add('is-connect-source');
      }

      this.dom.nodeLayer.appendChild(nodeGroup);
    });
  }

  /**
   * エッジを描画します。
   */
  _renderEdges() {
    this.dom.edgeLayer.textContent = '';
    const state = this.store.getState();

    state.edges.forEach((edge) => {
      const fromNode = this.store.getNodeById(edge.from);
      const toNode = this.store.getNodeById(edge.to);
      if (!fromNode || !toNode) {
        return;
      }

      const startPoint = this._getBoundaryPoint(fromNode, toNode);
      const endPoint = this._getBoundaryPoint(toNode, fromNode);
      const edgeGroup = createSvgElement('g', {
        class: 'diagram-edge',
        'data-edge-id': edge.id,
      });

      const edgeLine = createSvgElement('line', {
        class: 'diagram-edge-line',
        x1: startPoint.x,
        y1: startPoint.y,
        x2: endPoint.x,
        y2: endPoint.y,
        'marker-end': 'url(#arrowHead)',
      });

      edgeGroup.appendChild(edgeLine);
      if (this.selection.kind === 'edge' && this.selection.id === edge.id) {
        edgeGroup.classList.add('is-selected');
      }

      this.dom.edgeLayer.appendChild(edgeGroup);
    });
  }

  /**
   * ノード境界上の接続点を求めます。
   *
   * @param {Object} sourceNode 始点ノード。
   * @param {Object} targetNode 終点ノード。
   * @returns {{x:number, y:number}} 接続点。
   */
  _getBoundaryPoint(sourceNode, targetNode) {
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;

    if (dx === 0 && dy === 0) {
      return { x: sourceNode.x, y: sourceNode.y };
    }

    if (sourceNode.type === NODE_TYPES.ELLIPSE) {
      const rx = sourceNode.width / 2;
      const ry = sourceNode.height / 2;
      const factor = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
      return {
        x: sourceNode.x + dx * factor,
        y: sourceNode.y + dy * factor,
      };
    }

    const halfWidth = sourceNode.width / 2;
    const halfHeight = sourceNode.height / 2;
    const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(halfWidth / dx);
    const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(halfHeight / dy);
    const factor = Math.min(scaleX, scaleY);
    return {
      x: sourceNode.x + dx * factor,
      y: sourceNode.y + dy * factor,
    };
  }

  /**
   * 複数行ラベルを描画します。
   *
   * @param {SVGTextElement} labelElement ラベル要素。
   * @param {string} text ラベル文字列。
   * @param {number} x 中心X座標。
   * @param {number} y 中心Y座標。
   */
  _applyMultiLineLabel(labelElement, text, x, y) {
    const lines = sanitizeLabel(text).split('\n').slice(0, 4);
    if (lines.length === 0) {
      return;
    }

    const baseOffset = (lines.length - 1) / 2;
    lines.forEach((line, index) => {
      const tspan = createSvgElement('tspan', {
        x,
        y,
        dy: `${(index - baseOffset) * 1.2}em`,
      });
      tspan.textContent = line || ' ';
      labelElement.appendChild(tspan);
    });
  }

  /**
   * プロパティパネルを更新します。
   */
  _updatePropertiesPanel() {
    const controls = [
      this.dom.propLabel,
      this.dom.propX,
      this.dom.propY,
      this.dom.propWidth,
      this.dom.propHeight,
      this.dom.propFill,
      this.dom.propStroke,
      this.dom.applyPropertiesButton,
    ];

    if (this.selection.kind !== 'node' || !this.selection.id) {
      this.dom.selectionInfo.textContent = '選択中: なし';
      controls.forEach((control) => {
        control.disabled = true;
      });
      return;
    }

    const selectedNode = this.store.getNodeById(this.selection.id);
    if (!selectedNode) {
      this.dom.selectionInfo.textContent = '選択中: なし';
      controls.forEach((control) => {
        control.disabled = true;
      });
      return;
    }

    this.dom.selectionInfo.textContent = `選択中: ${this._formatNodeType(selectedNode.type)} (${
      selectedNode.id
    })`;
    controls.forEach((control) => {
      control.disabled = false;
    });

    this.dom.propLabel.value = selectedNode.label;
    this.dom.propX.value = selectedNode.x.toFixed(1);
    this.dom.propY.value = selectedNode.y.toFixed(1);
    this.dom.propWidth.value = selectedNode.width.toFixed(1);
    this.dom.propHeight.value = selectedNode.height.toFixed(1);
    this.dom.propFill.value = selectedNode.fill;
    this.dom.propStroke.value = selectedNode.stroke;
  }

  /**
   * キャンバス座標をワールド座標へ変換します。
   *
   * @param {number} clientX 画面X座標。
   * @param {number} clientY 画面Y座標。
   * @returns {{x:number, y:number}} ワールド座標。
   */
  _clientToWorld(clientX, clientY) {
    const rect = this.dom.svg.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    return {
      x: (canvasX - this.viewport.x) / this.viewport.scale,
      y: (canvasY - this.viewport.y) / this.viewport.scale,
    };
  }

  /**
   * ズームUIを更新します。
   */
  _updateZoomUi() {
    const zoomPercent = Math.round(this.viewport.scale * 100);
    this.dom.zoomRange.value = String(zoomPercent);
    this.dom.zoomLabel.textContent = `${zoomPercent}%`;
  }

  /**
   * ステータスメッセージを更新します。
   *
   * @param {string} message メッセージ。
   */
  _updateStatus(message) {
    this.dom.statusText.textContent = message;
  }

  /**
   * トーストを表示します。
   *
   * @param {string} message メッセージ。
   * @param {boolean} isError エラー表示の場合はtrue。
   */
  _showToast(message, isError = false) {
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }

    this.dom.toast.textContent = message;
    this.dom.toast.classList.toggle('is-error', isError);
    this.dom.toast.classList.add('is-visible');
    this.toastTimer = window.setTimeout(() => {
      this.dom.toast.classList.remove('is-visible');
    }, 1800);
  }

  /**
   * ツール名を整形します。
   *
   * @param {string} toolType ツール種別。
   * @returns {string} 表示名。
   */
  _formatToolName(toolType) {
    const map = {
      [TOOL_TYPES.SELECT]: '選択',
      [TOOL_TYPES.RECTANGLE]: '四角形',
      [TOOL_TYPES.ELLIPSE]: '円',
      [TOOL_TYPES.NOTE]: 'ノート',
      [TOOL_TYPES.CONNECT]: '接続',
    };
    return map[toolType] || toolType;
  }

  /**
   * ノード種別名を整形します。
   *
   * @param {string} nodeType ノード種別。
   * @returns {string} 表示名。
   */
  _formatNodeType(nodeType) {
    const map = {
      [NODE_TYPES.RECTANGLE]: '四角形',
      [NODE_TYPES.ELLIPSE]: '円',
      [NODE_TYPES.NOTE]: 'ノート',
    };
    return map[nodeType] || nodeType;
  }

  /**
   * 入力要素上でキー入力されているか判定します。
   *
   * @param {EventTarget|null} target 入力ターゲット。
   * @returns {boolean} 入力系要素であればtrue。
   */
  _isInputTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new DiagramApp();
  app.initialize();
});
