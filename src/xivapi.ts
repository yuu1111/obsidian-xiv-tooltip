import type { ActionData, Language, XivApiSearchResponse, XivApiSheetRow } from "./types";

/**
 * @description XIVAPI v2のベースURL
 */
const XIVAPI_BASE = "https://v2.xivapi.com";

/**
 * @description CJK文字の判定に使う正規表現
 */
const HAS_CJK = /[぀-ヿ㐀-䶿一-鿿]/;

/**
 * @description CJK文字の有無から検索言語を判定する
 * @param text - 判定対象テキスト
 * @returns 検索言語
 */
function detectLanguage(text: string): Language {
	return HAS_CJK.test(text) ? "ja" : "en";
}

/**
 * @description アセットパスをXIVAPI画像URLに変換する
 * @param path - XIVAPIのアセットパス
 * @returns PNG形式の画像URL
 */
function buildIconUrl(path: string): string {
	return `${XIVAPI_BASE}/api/asset?path=${encodeURIComponent(path)}&format=png`;
}

/**
 * @description ClassJobCategory>=1で廃止アクションを除外したXIVAPIクエリ文字列を生成する
 * @param name - アクション名
 * @param lang - 検索言語
 * @param op - 完全一致("=")か部分一致("~")か
 * @returns XIVAPIクエリ文字列
 */
function buildQuery(name: string, lang: Language, op: "=" | "~"): string {
	const field = lang === "ja" ? "Name@ja" : "Name";
	return `+${field}${op}"${name}" +ClassJobCategory>=1`;
}

/**
 * @description 完全一致優先、未ヒットなら部分一致にフォールバックしてrow_idを解決する
 * @param name - アクション名
 * @param lang - 検索言語
 * @returns 見つかったrow_id、未発見時はnull
 */
async function findRowId(name: string, lang: Language): Promise<number | null> {
	for (const op of ["=", "~"] as const) {
		const params = new URLSearchParams({
			query: buildQuery(name, lang, op),
			sheets: "Action",
			language: lang,
			fields: "Name",
			limit: "10",
		});
		const res = await fetch(`${XIVAPI_BASE}/api/search?${params}`);
		if (!res.ok) throw new Error(`XIVAPI search failed: ${res.status}`);

		const data: XivApiSearchResponse = await res.json();
		const first = data.results.at(0);
		if (!first) continue;

		const best = data.results.find((r) => r.fields.Name === name) ?? first;
		return best.row_id;
	}
	return null;
}

/**
 * @description Actionシートの1行を取得する。transient.Descriptionにアクション説明文が含まれる。
 * @param rowId - 取得対象のrow_id
 * @param lang - 取得言語
 * @returns Actionシートの1行データ
 */
async function fetchSheetRow(rowId: number, lang: Language): Promise<XivApiSheetRow> {
	const params = new URLSearchParams({ language: lang, fields: "Name,Icon" });
	const res = await fetch(`${XIVAPI_BASE}/api/sheet/Action/${rowId}?${params}`);
	if (!res.ok) throw new Error(`XIVAPI sheet fetch failed: ${res.status}`);
	return res.json() as Promise<XivApiSheetRow>;
}

/**
 * @description アクション名でXIVAPIを検索してActionDataを構築する
 * @param name - アクション名
 * @param lang - 検索言語
 * @returns 取得成功時はActionData、未発見時はnull
 */
async function searchAction(name: string, lang: Language): Promise<ActionData | null> {
	const rowId = await findRowId(name, lang);
	if (rowId === null) return null;

	const row = await fetchSheetRow(rowId, lang);
	const icon = row.fields.Icon;
	const iconPath = icon?.path_hr1 ?? icon?.path ?? null;

	return {
		id: rowId,
		displayName: row.fields.Name,
		iconUrl: iconPath ? buildIconUrl(iconPath) : null,
		description: row.transient?.Description ?? "",
		lang,
	};
}

/**
 * @description アクション検索結果のメモリキャッシュ。inflightマップで重複リクエストを排除する。
 */
export class ActionCache {
	private readonly cache = new Map<string, ActionData | null>();
	private readonly inflight = new Map<string, Promise<ActionData | null>>();

	/**
	 * @description キャッシュから同期的に読み出す
	 * @param name - アクション名
	 * @returns キャッシュ済みならActionDataまたはnull、未取得ならundefined
	 */
	getCached(name: string): ActionData | null | undefined {
		if (!this.cache.has(name)) return undefined;
		return this.cache.get(name) ?? null;
	}

	/**
	 * @description バックグラウンドでフェッチを開始し完了時にコールバックを呼ぶ。キャッシュ済みの場合はonLoadは呼ばれない。
	 * @param name - アクション名
	 * @param onLoad - 取得完了時コールバック
	 */
	prefetch(name: string, onLoad: () => void): void {
		if (this.cache.has(name)) return;
		const pending = this.inflight.get(name);
		if (pending) {
			void pending.then(onLoad);
			return;
		}
		void this.get(name).then(onLoad);
	}

	/**
	 * @description キャッシュまたはAPIからアクションデータを取得する。並行リクエストは単一Promiseに集約される。
	 * @param name - アクション名
	 * @returns ActionData、未発見時はnull
	 */
	async get(name: string): Promise<ActionData | null> {
		if (this.cache.has(name)) return this.cache.get(name) as ActionData | null;
		const pending = this.inflight.get(name);
		if (pending) return pending;

		const lang = detectLanguage(name);
		const promise = searchAction(name, lang)
			.then((result) => {
				this.cache.set(name, result);
				return result;
			})
			.finally(() => {
				this.inflight.delete(name);
			});

		this.inflight.set(name, promise);
		return promise;
	}

	/**
	 * @description キャッシュとinflight Promiseを全消去する。プラグインアンロード時に呼ぶ。
	 */
	clear(): void {
		this.cache.clear();
		this.inflight.clear();
	}
}
