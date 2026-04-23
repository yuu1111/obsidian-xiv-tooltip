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
		Icon?: XivApiIcon;
	};
}

export interface XivApiSearchResponse {
	next: string | null;
	results: XivApiSearchResult[];
}

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

export type Part =
	| { type: "text"; content: string }
	| { type: "action"; name: string };
