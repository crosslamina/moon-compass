/**
 * 日本語翻訳データ
 */
export const jaTranslations = {
    // UI要素
    'ui.title': '月見コンパス',
    'ui.permissionRequest': 'センサー権限を許可',
    'ui.locationPermission': '位置情報の許可',
    'ui.info': '詳細情報',
    'ui.settings': '設定',
    'ui.close': '閉じる',

    // コンパス・方向
    'compass.userDirection': 'あなたの方向',
    'compass.moonPosition': '月の位置',
    'compass.needle.red': '赤針',
    'compass.needle.gold': '金針',

    // 月の情報
    'moon.direction': '方向',
    'moon.distance': '距離',
    'moon.altitude': '高度',
    'moon.phase': '月齢',
    'moon.illumination': '照明率',
    'moon.rise': '月の出',
    'moon.set': '月の入り',
    'moon.currentTime': '現在時刻',
    'moon.state': '月の状態',

    // 月相名
    'moonPhase.newMoon': '新月',
    'moonPhase.crescentMoon': '三日月',
    'moonPhase.firstQuarterApproaching': '上弦前',
    'moonPhase.firstQuarter': '上弦の月',
    'moonPhase.firstQuarterPast': '上弦後',
    'moonPhase.fullMoonApproaching': '満月前',
    'moonPhase.fullMoon': '満月',
    'moonPhase.lastQuarterApproaching': '下弦前',
    'moonPhase.lastQuarter': '下弦の月',
    'moonPhase.waningMoon': '有明月',

    // 時刻・時間
    'time.today': '本日',
    'time.none': 'なし',
    'time.remaining': 'あと{{hours}}:{{minutes}}',
    'time.alwaysBelow': '常に地平線下',
    'time.alwaysAbove': '常に地平線上',
    'time.specialStatus': '常に地平線下 または 常に地平線上',

    // 位置情報・センサー
    'location.detecting': '位置情報を取得中...',
    'location.denied': '位置情報の取得が拒否されました',
    'location.unavailable': '位置情報が利用できません',
    'location.timeout': '位置情報の取得がタイムアウトしました',
    'location.error': '位置情報の取得でエラーが発生しました',
    'location.unsupported': 'このブラウザは位置情報に対応していません',
    'location.permissionDenied': '位置情報の権限が拒否されています',

    // 設定項目
    'settings.title': '設定',
    'settings.sensitivity': '感度設定',
    'settings.orientationCorrection': '方位角補正',
    'settings.display': '表示設定',
    'settings.language': '言語設定',
    'settings.eastWestReverse': '東西反転補正',
    'settings.resetCorrection': '補正リセット',
    'settings.detectionDisplay': '検出レベル表示',
    'settings.detectionDisplayStatus': '検出レベル表示: {{status}}',
    'settings.status.on': 'ON',
    'settings.status.off': 'OFF',

    // ステータスメッセージ
    'status.correctionEnabled': '東西反転補正を有効にしました',
    'status.correctionDisabled': '東西反転補正を無効にしました',
    'status.correctionReset': '補正をリセットしました',
    'status.correctionReversed': '方位角東西反転補正: {{status}}',
    'status.correctionOffset': '方位角オフセット設定: {{offset}}°',
    'status.enabled': '有効',
    'status.disabled': '無効',

    // 詳細情報
    'info.title': '詳細情報',
    'info.moonState': '月の状態・時刻',
    'info.locationSensor': '位置・センサー',
    'info.deviceOrientation': '方位: {{azimuth}}° | 傾き: {{tilt}}°',
    'info.coordinates': '座標',

    // エラーメッセージ
    'error.sensorNotSupported': 'センサーがサポートされていません',
    'error.permissionRequired': '権限が必要です',
    'error.loadFailed': '読み込みに失敗しました',

    // 単位
    'unit.degree': '°',
    'unit.km': 'km',
    'unit.percent': '%',
    'unit.days': '日',

    // 方角
    'direction.north': '北',
    'direction.northeast': '北東',
    'direction.east': '東',
    'direction.southeast': '南東',
    'direction.south': '南',
    'direction.southwest': '南西',
    'direction.west': '西',
    'direction.northwest': '北西',

    // その他
    'label.noData': 'データなし',
    'label.loading': '読み込み中...',
    'label.unknown': '不明'
};
