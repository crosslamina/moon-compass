import { I18nManager } from '../i18n';

export class DialogManager {
    private static instance: DialogManager;
    
    // UI要素
    private infoButton: HTMLButtonElement | null;
    private infoDialog: HTMLElement | null;
    private closeDialogButton: HTMLButtonElement | null;
    private settingsButton: HTMLButtonElement | null;
    private settingsDialog: HTMLElement | null;
    private closeSettingsDialogButton: HTMLButtonElement | null;
    
    // 設定関連
    private detectionDisplayEnabled: boolean = false;
    private toggleDetectionDisplayButton: HTMLButtonElement | null;
    private detectionDisplayStatus: HTMLElement | null;
    private i18n: I18nManager;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.infoButton = document.getElementById('info-button') as HTMLButtonElement;
        this.infoDialog = document.getElementById('info-dialog');
        this.closeDialogButton = document.getElementById('close-dialog') as HTMLButtonElement;
        this.settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
        this.settingsDialog = document.getElementById('settings-dialog');
        this.closeSettingsDialogButton = document.getElementById('close-settings-dialog') as HTMLButtonElement;
        
        // 新しい設定関連要素
        this.toggleDetectionDisplayButton = document.getElementById('toggle-detection-display-btn') as HTMLButtonElement;
        this.detectionDisplayStatus = document.getElementById('detection-display-status');
        
        this.setupEventListeners();
        this.loadSettings();
        
        // 言語変更を監視
        this.i18n.subscribe(() => {
            this.updateDetectionDisplayStatus();
        });
    }

    public static getInstance(): DialogManager {
        if (!DialogManager.instance) {
            DialogManager.instance = new DialogManager();
        }
        return DialogManager.instance;
    }

    private setupEventListeners(): void {
        // 詳細情報ダイアログのイベントリスナー
        if (this.infoButton) {
            this.infoButton.onclick = () => this.openInfoDialog();
        }

        if (this.closeDialogButton) {
            this.closeDialogButton.onclick = () => this.closeInfoDialog();
        }

        // 設定ダイアログのイベントリスナー
        if (this.settingsButton) {
            this.settingsButton.onclick = () => this.openSettingsDialog();
        }

        if (this.closeSettingsDialogButton) {
            this.closeSettingsDialogButton.onclick = () => this.closeSettingsDialog();
        }

        // 検出レベル表示設定ボタン
        if (this.toggleDetectionDisplayButton) {
            this.toggleDetectionDisplayButton.onclick = () => this.toggleDetectionDisplay();
        }

        // ダイアログの背景クリックで閉じる
        if (this.infoDialog) {
            this.infoDialog.onclick = (event) => {
                if (event.target === this.infoDialog) {
                    this.closeInfoDialog();
                }
            };
        }

        if (this.settingsDialog) {
            this.settingsDialog.onclick = (event) => {
                if (event.target === this.settingsDialog) {
                    this.closeSettingsDialog();
                }
            };
        }

        // ESCキーでダイアログを閉じる
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.infoDialog && this.infoDialog.style.display === 'flex') {
                    this.closeInfoDialog();
                } else if (this.settingsDialog && this.settingsDialog.style.display === 'flex') {
                    this.closeSettingsDialog();
                }
            }
        });
    }

    public initialize(): void {
        console.log('💬 DialogManagerを初期化しました');
    }

    /**
     * 詳細情報ダイアログを開く
     */
    private openInfoDialog(): void {
        // 設定ダイアログが開いている場合は閉じる
        if (this.settingsDialog && this.settingsDialog.style.display === 'flex') {
            this.closeSettingsDialog();
        }
        
        if (this.infoDialog) {
            this.infoDialog.style.display = 'flex';
            // フェードイン効果
            setTimeout(() => {
                this.infoDialog!.style.opacity = '1';
            }, 10);
        }
    }

    /**
     * 詳細情報ダイアログを閉じる
     */
    private closeInfoDialog(): void {
        if (this.infoDialog) {
            this.infoDialog.style.opacity = '0';
            // フェードアウト後に非表示
            setTimeout(() => {
                this.infoDialog!.style.display = 'none';
            }, 300);
        }
    }

    /**
     * 設定ダイアログを開く
     */
    private openSettingsDialog(): void {
        // 詳細情報ダイアログが開いている場合は閉じる
        if (this.infoDialog && this.infoDialog.style.display === 'flex') {
            this.closeInfoDialog();
        }
        
        if (this.settingsDialog) {
            this.settingsDialog.style.display = 'flex';
            // フェードイン効果
            setTimeout(() => {
                this.settingsDialog!.style.opacity = '1';
            }, 10);
        }
    }

    /**
     * 設定ダイアログを閉じる
     */
    private closeSettingsDialog(): void {
        if (this.settingsDialog) {
            this.settingsDialog.style.opacity = '0';
            // フェードアウト後に非表示
            setTimeout(() => {
                this.settingsDialog!.style.display = 'none';
            }, 300);
        }
    }

    // 公開メソッド
    public openInfo(): void {
        this.openInfoDialog();
    }

    public closeInfo(): void {
        this.closeInfoDialog();
    }

    public openSettings(): void {
        this.openSettingsDialog();
    }

    public closeSettings(): void {
        this.closeSettingsDialog();
    }

    public isInfoDialogOpen(): boolean {
        return this.infoDialog?.style.display === 'flex';
    }

    public isSettingsDialogOpen(): boolean {
        return this.settingsDialog?.style.display === 'flex';
    }

    public closeAllDialogs(): void {
        this.closeInfoDialog();
        this.closeSettingsDialog();
    }

    /**
     * 設定を読み込み
     */
    private loadSettings(): void {
        // LocalStorageから設定を読み込み
        const saved = localStorage.getItem('moonapp_detection_display');
        this.detectionDisplayEnabled = saved === 'true';
        this.updateDetectionDisplayStatus();
    }

    /**
     * 検出レベル表示の切り替え
     */
    private toggleDetectionDisplay(): void {
        this.detectionDisplayEnabled = !this.detectionDisplayEnabled;
        
        // LocalStorageに保存
        localStorage.setItem('moonapp_detection_display', this.detectionDisplayEnabled.toString());
        
        // ステータス表示を更新
        this.updateDetectionDisplayStatus();
        
        // 月ステータス表示の更新
        this.updateMoonStatusDisplayMode();
    }

    /**
     * 検出レベル表示ステータスの更新
     */
    private updateDetectionDisplayStatus(): void {
        if (this.detectionDisplayStatus) {
            const status = this.detectionDisplayEnabled ? 
                this.i18n.t('settings.status.on') : 
                this.i18n.t('settings.status.off');
            this.detectionDisplayStatus.textContent = this.i18n.t('settings.detectionDisplayStatus', { status });
        }

        if (this.toggleDetectionDisplayButton) {
            if (this.detectionDisplayEnabled) {
                this.toggleDetectionDisplayButton.classList.add('active');
            } else {
                this.toggleDetectionDisplayButton.classList.remove('active');
            }
        }
    }

    /**
     * 月ステータス表示モードの更新
     */
    private updateMoonStatusDisplayMode(): void {
        const moonStatusDisplay = document.querySelector('.moon-status-display');
        if (moonStatusDisplay) {
            if (this.detectionDisplayEnabled) {
                moonStatusDisplay.classList.add('detailed');
            } else {
                moonStatusDisplay.classList.remove('detailed');
            }
        }
    }

    /**
     * 検出レベル表示の状態を取得
     */
    public isDetectionDisplayEnabled(): boolean {
        return this.detectionDisplayEnabled;
    }
}
