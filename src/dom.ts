import { GARLAND_BASE } from "./constants";
import type { ActionData } from "./types";

/**
 * アクション名とデータを受け取り、既存の span 要素を icon + label + tooltip で埋める。
 * Reading View (main.ts) と Live Preview (livepreview.ts) の両方から呼ばれる。
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
