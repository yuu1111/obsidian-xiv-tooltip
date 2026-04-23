import type { ActionData, Language, XivApiSearchResponse, XivApiSheetRow } from "./types";

/**
 * @description XIVAPI v2のベースURL
 */
const XIVAPI_BASE = "https://v2.xivapi.com";

/**
 * @description CJK文字判定用正規表現 (ひらがな・カタカナ・漢字)
 */
const HAS_CJK = /[぀-ヿ㐀-䶿一-鿿]/;

/**
 * @description テキストに含まれる文字から言語を推定する
 * @param text - 判定対象テキスト
 * @returns 検出された言語コード
 */
export function detectLanguage(text: string): Language {
	return HAS_CJK.test(text) ? "ja" : "en";
}

/**
 * @description アイコンアセットのURLを生成する
 * @param path - XIVAPIのアセットパス
 * @returns PNG形式のアイコンURL
 */
export function buildIconUrl(path: string): string {
	return `${XIVAPI_BASE}/api/asset?path=${encodeURIComponent(path)}&format=png`;
}

/**
 * @description XIVAPI v2 search query文字列を生成する
 *
 * @param name - 検索するアクション名
 * @param lang - 検索対象の言語
 * @param op - `=` 完全一致 / `~` 部分一致
 * @returns クエリ文字列
 */
function buildQuery(name: string, lang: Language, op: "=" | "~"): string {
	const field = lang === "ja" ? "Name@ja" : "Name";
	return `${field}${op}"${name}"`;
}

/**
 * @description アクション名からXIVAPIのrow_idを解決する。
 * 完全一致を優先し、一致しない場合は部分一致にフォールバックする。
 *
 * @param name - 検索するアクション名
 * @param lang - 検索対象の言語
 * @returns 見つかったrow_id、未発見時は `null`
 * @throws XIVAPI HTTPエラー時
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
 * @description Action シートの1行をrow_idで取得する。
 * `transient.Description` にアクション説明文が含まれる。
 *
 * @param rowId - 取得するrow_id
 * @param lang - 返却データの言語
 * @returns シート行データ
 * @throws XIVAPI HTTPエラー時
 */
async function fetchSheetRow(rowId: number, lang: Language): Promise<XivApiSheetRow> {
	const params = new URLSearchParams({ language: lang, fields: "Name,Icon" });
	const res = await fetch(`${XIVAPI_BASE}/api/sheet/Action/${rowId}?${params}`);
	if (!res.ok) throw new Error(`XIVAPI sheet fetch failed: ${res.status}`);
	return res.json() as Promise<XivApiSheetRow>;
}

/**
 * @description アクション名でXIVAPIを検索し、アイコン・説明文を含むデータを返す。
 * 検索(row_id解決)→シート取得(アイコン+説明文)の2段階で取得する。
 *
 * @param name - アクション名
 * @param lang - 検索・取得言語
 * @returns アクションデータ、未発見時は `null`
 * @throws XIVAPI HTTPエラー時
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
	 * @description キャッシュ優先でアクションデータを取得する
	 * @param name - アクション名
	 * @returns アクションデータ (未発見時はnull)
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
	 * @description キャッシュと進行中リクエストをすべてクリアする
	 */
	clear(): void {
		this.cache.clear();
		this.inflight.clear();
	}
}
