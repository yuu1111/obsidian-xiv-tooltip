/**
 * @description XIVAPIクエリ言語
 */
export type Language = "ja" | "en";

/**
 * @description アクション表示に必要なデータセット
 * @property id - XIVAPI上のrow_id
 * @property displayName - 表示用アクション名
 * @property iconUrl - アイコン画像URL @optional
 * @property description - アクション説明文
 * @property lang - 取得時の言語
 */
export interface ActionData {
	id: number;
	displayName: string;
	iconUrl: string | null;
	description: string;
	lang: Language;
}

/**
 * @description XIVAPIのアイコン情報
 * @property path - 通常解像度のアセットパス
 * @property path_hr1 - 高解像度(x2)のアセットパス
 */
export interface XivApiIcon {
	id: number;
	path: string;
	path_hr1: string;
}

/**
 * @description XIVAPI検索結果の1件
 */
export interface XivApiSearchResult {
	score: number;
	sheet: string;
	row_id: number;
	fields: {
		Name: string;
		Icon?: XivApiIcon;
	};
}

/**
 * @description XIVAPI検索レスポンス
 * @property next - 次ページカーソル @optional
 * @property results - 検索結果リスト
 */
export interface XivApiSearchResponse {
	next: string | null;
	results: XivApiSearchResult[];
}

/**
 * @description XIVAPI Actionシートの1行データ
 * @property transient - 説明文等の遅延読み込みフィールド @optional
 */
export interface XivApiSheetRow {
	row_id: number;
	fields: {
		Name: string;
		Icon?: XivApiIcon;
	};
	transient?: {
		Description?: string;
	};
}

/**
 * @description テキストノードを分割したパーツ
 */
export type Part =
	| { type: "text"; content: string }
	| { type: "action"; name: string };
