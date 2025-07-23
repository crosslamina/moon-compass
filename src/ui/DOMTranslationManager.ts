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
        // 音量設定
        const volumeTitle = document.querySelector('.setting-card .setting-title');
        if (volumeTitle && volumeTitle.textContent?.includes('音量')) {
            volumeTitle.textContent = '音量';
        }

        // 感度設定
        const sensitivityTitle = document.querySelector('.setting-title');
        if (sensitivityTitle && sensitivityTitle.textContent?.includes('感度')) {
            sensitivityTitle.textContent = this.i18n.t('settings.sensitivity');
        }

        // 方位角補正
        const orientationTitle = document.querySelector('.setting-title');
        if (orientationTitle && orientationTitle.textContent?.includes('方位角補正')) {
            orientationTitle.textContent = this.i18n.t('settings.orientationCorrection');
        }

        // 言語設定
        const languageTitle = document.querySelectorAll('.setting-title');
        languageTitle.forEach(title => {
            if (title.textContent?.includes('言語設定')) {
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
     * 初期化時に翻訳を適用
     */
    public initialize(): void {
        this.updateAllTranslations();
        console.log('🌍 DOM翻訳マネージャーを初期化しました');
    }
}
