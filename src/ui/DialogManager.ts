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
    private i18n: I18nManager;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.infoButton = document.getElementById('info-button') as HTMLButtonElement;
        this.infoDialog = document.getElementById('info-dialog');
        this.closeDialogButton = document.getElementById('close-dialog') as HTMLButtonElement;
        this.settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
        this.settingsDialog = document.getElementById('settings-dialog');
        this.closeSettingsDialogButton = document.getElementById('close-settings-dialog') as HTMLButtonElement;
        
        this.setupEventListeners();
        this.loadSettings();
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
        // LocalStorageから設定を読み込み（将来の設定項目用）
    }
}
