import type { ActionData, Language, XivApiSearchResponse } from "./types";

const XIVAPI_BASE = "https://v2.xivapi.com";
const HAS_CJK = /[぀-ヿ㐀-䶿一-鿿]/;

export function detectLanguage(text: string): Language {
	return HAS_CJK.test(text) ? "ja" : "en";
}

export function buildIconUrl(path: string): string {
	return `${XIVAPI_BASE}/api/asset?path=${encodeURIComponent(path)}&format=png`;
}

export async function searchAction(
	name: string,
	lang: Language,
): Promise<ActionData | null> {
	const params = new URLSearchParams({
		query: name,
		sheets: "Action",
		language: lang,
		fields: "Name,Icon,Description",
		limit: "10",
	});

	const res = await fetch(`${XIVAPI_BASE}/api/search?${params}`);
	if (!res.ok) throw new Error(`XIVAPI responded ${res.status}`);

	const data: XivApiSearchResponse = await res.json();
	const first = data.results.at(0);
	if (!first) return null;

	const best = data.results.find((r) => r.fields.Name === name) ?? first;
	const icon = best.fields.Icon;
	const iconPath = icon?.path_hr1 ?? icon?.path ?? null;

	return {
		id: best.row_id,
		displayName: best.fields.Name,
		iconUrl: iconPath ? buildIconUrl(iconPath) : null,
		description: best.fields.Description ?? "",
		lang,
	};
}

export class ActionCache {
	private readonly cache = new Map<string, ActionData | null>();
	private readonly inflight = new Map<string, Promise<ActionData | null>>();

	async get(name: string): Promise<ActionData | null> {
		if (this.cache.has(name)) return this.cache.get(name) ?? null;
		const pending = this.inflight.get(name);
		if (pending) return pending;

		const lang = detectLanguage(name);
		const promise = searchAction(name, lang).then((result) => {
			this.cache.set(name, result);
			this.inflight.delete(name);
			return result;
		});

		this.inflight.set(name, promise);
		return promise;
	}

	clear(): void {
		this.cache.clear();
		this.inflight.clear();
	}
}
