import { I18nManager } from '../i18n';

/**
 * DOM要素の翻訳を管理するクラス
 */
export class DOMTranslationManager {
    private static instance: DOMTranslationManager;
    private i18n: I18nManager;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.setupSubscription();
    }

    public static getInstance(): DOMTranslationManager {
        if (!DOMTranslationManager.instance) {
            DOMTranslationManager.instance = new DOMTranslationManager();
        }
        return DOMTranslationManager.instance;
    }

    /**
     * 言語変更を監視して DOM を更新
     */
    private setupSubscription(): void {
        this.i18n.subscribe(() => {
            this.updateAllTranslations();
        });
    }

    /**
     * すべての翻訳対象要素を更新
     */
    public updateAllTranslations(): void {
        this.updateTitle();
        this.updateButtons();
        this.updateLabels();
        this.updateCompassInfo();
        this.updateDialogHeaders();
        this.updateSettingCards();
        this.updateInfoCards();
    }

    /**
     * ページタイトルの更新
     */
    private updateTitle(): void {
        document.title = this.i18n.t('ui.title');
    }

    /**
     * ボタンテキストの更新
     */
    private updateButtons(): void {
        const locationPermissionButton = document.getElementById('location-permission-button');
        if (locationPermissionButton) {
            locationPermissionButton.textContent = this.i18n.t('ui.locationPermission');
        }

        const permissionButton = document.getElementById('permission-button');
        if (permissionButton) {
            permissionButton.textContent = this.i18n.t('ui.permissionRequest');
        }

        const closeDialogButton = document.getElementById('close-dialog');
        if (closeDialogButton) {
            closeDialogButton.setAttribute('title', this.i18n.t('ui.close'));
        }

        const closeSettingsDialogButton = document.getElementById('close-settings-dialog');
        if (closeSettingsDialogButton) {
            closeSettingsDialogButton.setAttribute('title', this.i18n.t('ui.close'));
        }
    }

    /**
     * コンパス情報の更新
     */
    private updateCompassInfo(): void {
        const compassInfo = document.getElementById('compass-info');
        if (compassInfo) {
            const needleLegend = compassInfo.querySelector('.needle-legend');
            if (needleLegend) {
                needleLegend.innerHTML = `
                    <span style="color: #dc143c;">●</span> ${this.i18n.t('compass.needle.red')}: ${this.i18n.t('compass.userDirection')}
                    <br><span style="color: #ffd700;">●</span> ${this.i18n.t('compass.needle.gold')}: ${this.i18n.t('compass.moonPosition')}
                `;
            }
        }
    }

    /**
     * ダイアログヘッダーの更新
     */
    private updateDialogHeaders(): void {
        // 設定ダイアログのタイトル
        const settingsTitle = document.querySelector('#settings-dialog .dialog-header h3');
        if (settingsTitle) {
            settingsTitle.textContent = `⚙️ ${this.i18n.t('ui.settings')}`;
        }

        // 詳細情報ダイアログのタイトル
        const infoTitle = document.querySelector('#info-dialog .dialog-header h3');
        if (infoTitle) {
            infoTitle.textContent = `ℹ️ ${this.i18n.t('ui.info')}`;
        }
    }

    /**
     * 設定カードの更新
     */
    private updateSettingCards(): void {
        // すべての設定タイトルを取得して、内容に応じて翻訳
        const settingTitles = document.querySelectorAll('.setting-title');
        settingTitles.forEach(title => {
            const textContent = title.textContent;
            if (textContent?.includes('音量')) {
                title.textContent = this.i18n.t('settings.volume');
            } else if (textContent?.includes('感度')) {
                title.textContent = this.i18n.t('settings.sensitivity');
            } else if (textContent?.includes('方位角補正')) {
                title.textContent = this.i18n.t('settings.orientationCorrection');
            } else if (textContent?.includes('表示設定')) {
                title.textContent = this.i18n.t('settings.display');
            } else if (textContent?.includes('言語設定')) {
                title.textContent = this.i18n.t('settings.language');
            }
        });

        // ボタンテキスト
        const toggleReverseBtn = document.getElementById('toggle-reverse-btn');
        if (toggleReverseBtn) {
            toggleReverseBtn.textContent = this.i18n.t('settings.eastWestReverse');
        }

        const resetCorrectionBtn = document.getElementById('reset-correction-btn');
        if (resetCorrectionBtn) {
            resetCorrectionBtn.textContent = this.i18n.t('settings.resetCorrection');
        }

        const toggleDetectionDisplayBtn = document.getElementById('toggle-detection-display-btn');
        if (toggleDetectionDisplayBtn) {
            toggleDetectionDisplayBtn.textContent = this.i18n.t('settings.detectionDisplay');
        }
    }

    /**
     * ラベルテキストの更新
     */
    private updateLabels(): void {
        // 検出レベル表示ステータス
        const detectionDisplayStatus = document.getElementById('detection-display-status');
        if (detectionDisplayStatus) {
            const isOn = detectionDisplayStatus.textContent?.includes('ON');
            const status = isOn ? this.i18n.t('settings.status.on') : this.i18n.t('settings.status.off');
            detectionDisplayStatus.textContent = this.i18n.t('settings.detectionDisplayStatus', { status });
        }
    }

    /**
     * 情報ダイアログの翻訳更新
     */
    private updateInfoCards(): void {
        // 情報ダイアログ内の情報カードタイトル
        const infoTitles = document.querySelectorAll('.info-title');
        infoTitles.forEach(title => {
            if (title.textContent?.includes('月の状態')) {
                title.textContent = this.i18n.t('info.moonState');
            } else if (title.textContent?.includes('位置・センサー')) {
                title.textContent = this.i18n.t('info.locationSensor');
            }
        });

        // 地図リンクの翻訳
        const mapLink = document.getElementById('map-link');
        if (mapLink) {
            mapLink.textContent = `🗺️ ${this.i18n.t('info.viewOnMap')}`;
        }
    }

    /**
     * 初期化時に翻訳を適用
     */
    public initialize(): void {
        this.updateAllTranslations();
        console.log('🌍 DOM翻訳マネージャーを初期化しました');
    }
}
