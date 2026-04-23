export type Language = "ja" | "en";

export interface ActionData {
	id: number;
	displayName: string;
	iconUrl: string | null;
	description: string;
	lang: Language;
}

export interface XivApiIcon {
	id: number;
	path: string;
	path_hr1: string;
}

export interface XivApiSearchResult {
	score: number;
	sheet: string;
	row_id: number;
	fields: {
		Name: string;
		Description?: string;
		Icon?: XivApiIcon;
	};
}

export interface XivApiSearchResponse {
	cursor: string | null;
	results: XivApiSearchResult[];
}
