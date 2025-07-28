import { I18nManager } from '../i18n/I18nManager';

/**
 * シンプルなお知らせパネルを管理するクラス
 * 単一のお知らせテキストを表示
 */
export class NotificationPanel {
    private static instance: NotificationPanel;
    
    private i18n: I18nManager;
    private panelElement: HTMLElement | null = null;
    private currentNotification: string | null = null;
    
    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.initializeNotification();
        this.createPanelElement();
        this.setupEventListeners();
    }
    
    public static getInstance(): NotificationPanel {
        if (!NotificationPanel.instance) {
            NotificationPanel.instance = new NotificationPanel();
        }
        return NotificationPanel.instance;
    }
    
    /**
     * 初期化処理
     */
    public initialize(): void {
        this.initializeNotification();
        this.createPanelElement();
        this.updatePanelTitles();
        this.refreshNotification();
        
        setTimeout(() => {
            this.updatePanelTitles();
        }, 100);
        
        console.log('📢 NotificationPanel initialized');
    }
    
    /**
     * 現在のお知らせ内容を初期化
     */
    private initializeNotification(): void {
        // 現在表示するお知らせの翻訳キー
        // 空文字列にするとお知らせが非表示になります
        this.currentNotification = this.i18n.t('notification.body');
    }
    
    /**
     * パネルのタイトル類を更新
     */
    private updatePanelTitles(): void {
        const titleText = this.i18n.t('notification.title');
        console.log('Updating panel titles with text:', titleText);
        
        // ボタンのタイトルを更新
        const button = document.getElementById('notification-button');
        if (button) {
            button.title = titleText;
        }
        
        // ヘッダーのタイトルを更新
        const headerTitle = this.panelElement?.querySelector('.notification-popup-header h3');
        if (headerTitle) {
            headerTitle.textContent = titleText;
        }
    }
    
    /**
     * お知らせを表示するかどうかを判定
     */
    private shouldShowNotification(): boolean {
        return this.currentNotification !== null && this.currentNotification !== '';
    }
    
    /**
     * 通知ボタンの表示状態を更新
     */
    private updateButtonVisibility(): void {
        const button = document.getElementById('notification-button');
        if (button) {
            if (this.shouldShowNotification()) {
                button.style.display = 'flex';
            } else {
                button.style.display = 'none';
            }
        }
    }
    private createPanelElement(): void {
        // 既存のパネルがある場合は削除
        const existingPanel = document.getElementById('notification-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // 通知アイコンボタンを作成
        this.createNotificationButton();
        
        // ポップアップパネル要素を作成
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'notification-panel';
        this.panelElement.className = 'notification-popup';
        this.panelElement.style.display = 'none';
        
        // ポップアップヘッダー
        const header = document.createElement('div');
        header.className = 'notification-popup-header';
        
        const title = document.createElement('h3');
        title.textContent = this.i18n.t('notification.title');
        
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-popup-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.hidePanel();
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
        // ポップアップボディ
        const body = document.createElement('div');
        body.className = 'notification-popup-body';
        body.id = 'notification-popup-body';
        
        // 通知内容を直接追加
        const notificationContent = document.createElement('div');
        notificationContent.className = 'notification-content';
        body.appendChild(notificationContent);
        
        this.panelElement.appendChild(header);
        this.panelElement.appendChild(body);
        
        // body要素に追加
        document.body.appendChild(this.panelElement);
    }
    
    /**
     * 通知アイコンボタンを作成
     */
    private createNotificationButton(): void {
        // 既存のボタンがある場合は削除
        const existingButton = document.getElementById('notification-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const button = document.createElement('button');
        button.id = 'notification-button';
        button.className = 'notification-icon-button';
        button.innerHTML = '📢';
        button.title = this.i18n.t('notification.title');
        button.onclick = () => this.togglePanel();
        
        // 未読通知数バッジ
        const badge = document.createElement('span');
        badge.id = 'notification-badge';
        badge.className = 'notification-badge';
        badge.style.display = 'none';
        
        button.appendChild(badge);
        
        // body要素に直接追加（右上固定）
        document.body.appendChild(button);
    }
    
    /**
     * パネルの表示/非表示を切り替え
     */
    private togglePanel(): void {
        if (!this.panelElement) return;
        
        if (this.panelElement.style.display === 'none') {
            this.showPanel();
        } else {
            this.hidePanel();
        }
    }
    
    /**
     * パネルを表示
     */
    private showPanel(): void {
        if (!this.panelElement) return;
        
        this.panelElement.style.display = 'block';
        // フェードイン効果
        setTimeout(() => {
            this.panelElement!.style.opacity = '1';
        }, 10);
        
        // バッジを非表示にする（パネル表示時）
        // バッジを非表示にする
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }
    
    /**
     * パネルを非表示
     */
    private hidePanel(): void {
        if (!this.panelElement) return;
        
        this.panelElement.style.opacity = '0';
        // フェードアウト後に非表示
        setTimeout(() => {
            this.panelElement!.style.display = 'none';
        }, 300);
    }
    
    /**
     * イベントリスナーの設定
     */
    private setupEventListeners(): void {
        // 言語変更時の更新
        this.i18n.subscribe(() => {
            this.initializeNotification(); // 通知内容を再取得
            this.refreshNotification();
            this.updatePanelTitles();
        });
        
        // ESCキーでパネルを閉じる
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.panelElement?.style.display === 'block') {
                this.hidePanel();
            }
        });
        
        // 外側クリックでパネルを閉じる
        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const panel = this.panelElement;
            const button = document.getElementById('notification-button');
            
            if (panel && panel.style.display === 'block' && 
                !panel.contains(target) && 
                !button?.contains(target)) {
                this.hidePanel();
            }
        });
    }
    
    /**
     * 通知コンテンツをリフレッシュ
     */
    private refreshNotification(): void {
        console.log('Refreshing notification');
        
        // ボタンの表示状態を更新
        this.updateButtonVisibility();
        
        // 通知コンテンツ要素を更新
        const content = this.panelElement?.querySelector('.notification-content');
        if (content) {
            content.innerHTML = '';
            
            // お知らせがある場合は表示
            if (this.shouldShowNotification()) {
                const notificationItem = document.createElement('div');
                notificationItem.className = 'notification-item notification-info';
                
                notificationItem.innerHTML = `
                    <span class="notification-icon">📢</span>
                    <div class="notification-content">
                        <div class="notification-message">${this.currentNotification || ''}</div>
                    </div>
                `;
                
                content.appendChild(notificationItem);
            } else {
                // お知らせがない場合のメッセージ
                const noNotifications = document.createElement('div');
                noNotifications.className = 'no-notifications';
                noNotifications.textContent = this.i18n.t('notification.noNotifications');
                content.appendChild(noNotifications);
            }
        }
    }
    
    /**
     * 現在の通知を設定
     */
    public setCurrentNotification(text: string): void {
        this.currentNotification = text;
        this.refreshNotification();
    }
    
    /**
     * リソースのクリーンアップ
     */
    public destroy(): void {
        if (this.panelElement) {
            this.panelElement.remove();
            this.panelElement = null;
        }
        
        const button = document.getElementById('notification-button');
        if (button) {
            button.remove();
        }
    }
}
