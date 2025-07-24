/**
 * DOM要素の管理と取得を一元化するクラス
 */
export class DOMManager {
    private static instance: DOMManager;
    private elements: Map<string, HTMLElement | null> = new Map();

    private constructor() {}

    static getInstance(): DOMManager {
        if (!DOMManager.instance) {
            DOMManager.instance = new DOMManager();
        }
        return DOMManager.instance;
    }

    /**
     * DOM要素を安全に取得・キャッシュ
     */
    getElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
        if (!this.elements.has(id)) {
            const element = document.getElementById(id) as T | null;
            this.elements.set(id, element);
            if (!element) {
                console.warn(`DOM element with id '${id}' not found`);
            }
        }
        return this.elements.get(id) as T | null;
    }

    /**
     * 必須要素を取得（エラーハンドリング付き）
     */
    getRequiredElement<T extends HTMLElement = HTMLElement>(id: string): T {
        const element = this.getElement<T>(id);
        if (!element) {
            throw new Error(`Required DOM element with id '${id}' not found`);
        }
        return element;
    }

    /**
     * 複数要素を一括取得
     */
    getElements<T extends HTMLElement = HTMLElement>(ids: string[]): Map<string, T | null> {
        const result = new Map<string, T | null>();
        ids.forEach(id => {
            result.set(id, this.getElement<T>(id));
        });
        return result;
    }

    /**
     * 要素が存在するかチェック
     */
    hasElement(id: string): boolean {
        return this.getElement(id) !== null;
    }

    /**
     * テキストを安全に設定
     */
    setText(id: string, text: string): boolean {
        const element = this.getElement(id);
        if (element) {
            element.textContent = text;
            return true;
        }
        return false;
    }

    /**
     * キャッシュをクリア
     */
    clearCache(): void {
        this.elements.clear();
    }
}
