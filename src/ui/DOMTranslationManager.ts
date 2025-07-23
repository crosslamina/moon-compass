import { I18nManager } from '../i18n';
import { GlobalTranslationUpdater } from '../i18n/GlobalTranslationUpdater';

/**
 * DOM要素の翻訳を管理するクラス
 */
export class DOMTranslationManager {
    private static instance: DOMTranslationManager;
    private i18n: I18nManager;
    private globalUpdater: GlobalTranslationUpdater;

    private constructor() {
        this.i18n = I18nManager.getInstance();
        this.globalUpdater = GlobalTranslationUpdater.getInstance();
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
        // 個別購読を削除し、グローバル更新システムに登録
        this.globalUpdater.registerUpdater('dom-translation', () => {
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
        // IDまたはクラスベースで設定タイトルを更新
        const volumeTitle = document.querySelector('[data-setting="volume"] .setting-title, .setting-title[data-key="volume"]');
        if (volumeTitle) {
            volumeTitle.textContent = this.i18n.t('settings.volume');
        }

        const sensitivityTitle = document.querySelector('[data-setting="sensitivity"] .setting-title, .setting-title[data-key="sensitivity"]');
        if (sensitivityTitle) {
            sensitivityTitle.textContent = this.i18n.t('settings.sensitivity');
        }

        const orientationTitle = document.querySelector('[data-setting="orientation"] .setting-title, .setting-title[data-key="orientation"]');
        if (orientationTitle) {
            orientationTitle.textContent = this.i18n.t('settings.orientationCorrection');
        }

        const displayTitle = document.querySelector('[data-setting="display"] .setting-title, .setting-title[data-key="display"]');
        if (displayTitle) {
            displayTitle.textContent = this.i18n.t('settings.display');
        }

        const languageTitle = document.querySelector('[data-setting="language"] .setting-title, .setting-title[data-key="language"]');
        if (languageTitle) {
            languageTitle.textContent = this.i18n.t('settings.language');
        }

        // フォールバック: data属性がない場合は順序ベースで更新
        const settingTitles = document.querySelectorAll('.setting-title');
        if (settingTitles.length >= 5) {
            settingTitles[0].textContent = this.i18n.t('settings.volume');
            settingTitles[1].textContent = this.i18n.t('settings.sensitivity');
            settingTitles[2].textContent = this.i18n.t('settings.orientationCorrection');
            settingTitles[3].textContent = this.i18n.t('settings.display');
            settingTitles[4].textContent = this.i18n.t('settings.language');
        }

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
            // data属性やクラスで状態を確認する方法に変更
            const statusElement = detectionDisplayStatus.closest('[data-status]');
            const isOn = statusElement?.getAttribute('data-status') === 'on' || 
                        detectionDisplayStatus.classList.contains('status-on') ||
                        detectionDisplayStatus.textContent?.includes('ON') || // フォールバック
                        detectionDisplayStatus.textContent?.includes('オン');
            
            const status = isOn ? this.i18n.t('settings.status.on') : this.i18n.t('settings.status.off');
            detectionDisplayStatus.textContent = this.i18n.t('settings.detectionDisplayStatus', { status });
        }
    }

    /**
     * 情報ダイアログの翻訳更新
     */
    private updateInfoCards(): void {
        // IDまたはクラスベースで情報カードタイトルを更新
        const moonStateTitle = document.querySelector('[data-info="moon-state"] .info-title, .info-title[data-key="moon-state"]');
        if (moonStateTitle) {
            moonStateTitle.textContent = this.i18n.t('info.moonState');
        }

        const locationSensorTitle = document.querySelector('[data-info="location-sensor"] .info-title, .info-title[data-key="location-sensor"]');
        if (locationSensorTitle) {
            locationSensorTitle.textContent = this.i18n.t('info.locationSensor');
        }

        // フォールバック: data属性がない場合は順序ベースで更新
        const infoTitles = document.querySelectorAll('.info-title');
        if (infoTitles.length >= 2) {
            infoTitles[0].textContent = this.i18n.t('info.moonState');
            infoTitles[1].textContent = this.i18n.t('info.locationSensor');
        }

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

    /**
     * リソースのクリーンアップ
     */
    public destroy(): void {
        this.globalUpdater.unregisterUpdater('dom-translation');
    }
}
