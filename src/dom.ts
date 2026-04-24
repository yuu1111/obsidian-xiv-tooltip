import { GARLAND_BASE } from "./constants";
import type { ActionData } from "./types";

/**
 * @description span要素をアイコン+ラベル+ツールチップで構成する。
 * Reading ViewとLive Previewの両方から利用される。
 * @param span - 操作対象のspan要素
 * @param name - マークダウン中に記述されたアクション名
 * @param data - XIVAPIから取得したアクションデータ
 */
export function populateActionSpan(span: HTMLElement, name: string, data: ActionData): void {
	if (data.iconUrl) {
		const img = document.createElement("img");
		img.src = data.iconUrl;
		img.className = "xiv-action-icon";
		img.alt = "";
		img.width = 20;
		img.height = 20;
		span.appendChild(img);
	}

	const label = document.createElement("span");
	label.className = "xiv-action-label";
	label.textContent = name;
	span.appendChild(label);

	const tooltip = document.createElement("div");
	tooltip.className = "xiv-tooltip";

	const nameEl = document.createElement("div");
	nameEl.className = "xiv-tooltip-name";
	nameEl.textContent = data.displayName;
	tooltip.appendChild(nameEl);

	if (data.description) {
		const descEl = document.createElement("div");
		descEl.className = "xiv-tooltip-desc";
		descEl.textContent = data.description;
		tooltip.appendChild(descEl);
	}

	const hint = document.createElement("div");
	hint.className = "xiv-tooltip-hint";
	hint.textContent = "クリックで詳細を開く";
	tooltip.appendChild(hint);

	span.appendChild(tooltip);

	span.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		window.open(`${GARLAND_BASE}/${data.id}`, "_blank");
	});
}
