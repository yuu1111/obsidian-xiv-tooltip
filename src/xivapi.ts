import type { ActionData, Language, XivApiSearchResponse, XivApiSheetRow } from "./types";

const XIVAPI_BASE = "https://v2.xivapi.com";
const HAS_CJK = /[぀-ヿ㐀-䶿一-鿿]/;

function detectLanguage(text: string): Language {
	return HAS_CJK.test(text) ? "ja" : "en";
}

function buildIconUrl(path: string): string {
	return `${XIVAPI_BASE}/api/asset?path=${encodeURIComponent(path)}&format=png`;
}

function buildQuery(name: string, lang: Language, op: "=" | "~"): string {
	const field = lang === "ja" ? "Name@ja" : "Name";
	// ClassJobCategory>=1 で廃止アクション(row_id=0)を除外する
	return `+${field}${op}"${name}" +ClassJobCategory>=1`;
}

/**
 * 完全一致を優先し、未ヒットなら部分一致にフォールバックして row_id を解決する。
 *
 * @param name - アクション名
 * @param lang - 検索言語
 * @returns 見つかった row_id、未発見時は `null`
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
 * Action シートの1行を取得する。
 * `transient.Description` にアクション説明文が含まれる。
 */
async function fetchSheetRow(rowId: number, lang: Language): Promise<XivApiSheetRow> {
	const params = new URLSearchParams({ language: lang, fields: "Name,Icon" });
	const res = await fetch(`${XIVAPI_BASE}/api/sheet/Action/${rowId}?${params}`);
	if (!res.ok) throw new Error(`XIVAPI sheet fetch failed: ${res.status}`);
	return res.json() as Promise<XivApiSheetRow>;
}

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

/** アクション検索結果のメモリキャッシュ。inflight マップで重複リクエストを排除する。 */
export class ActionCache {
	private readonly cache = new Map<string, ActionData | null>();
	private readonly inflight = new Map<string, Promise<ActionData | null>>();

	/**
	 * キャッシュから同期的にデータを返す。
	 *
	 * @returns キャッシュ済みなら `ActionData | null`、未取得なら `undefined`
	 */
	getCached(name: string): ActionData | null | undefined {
		if (!this.cache.has(name)) return undefined;
		return this.cache.get(name) ?? null;
	}

	/**
	 * バックグラウンドでフェッチを開始し、完了時にコールバックを呼ぶ。
	 * キャッシュ済みの場合は何もしない (onLoad は呼ばれない)。
	 * 取得中の場合は既存 Promise にコールバックを追加する。
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

	clear(): void {
		this.cache.clear();
		this.inflight.clear();
	}
}
