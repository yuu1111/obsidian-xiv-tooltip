import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";

import type { ActionCache } from "./xivapi";
import type { ActionData } from "./types";

const GARLAND_BASE = "https://garlandtools.org/db/#action";
const ACTION_PATTERN = /\{([^}]+)\}/g;

/**
 * @description データ読み込み完了を通知するStateEffect。
 * CM6のViewPlugin.update()でこのエフェクトを検出して装飾を再構築する。
 */
export const dataLoadedEffect = StateEffect.define<void>();

/**
 * @description Live Preview上で `{ActionName}` をアイコン+ラベルに置換するウィジェット。
 */
class XivActionWidget extends WidgetType {
	constructor(
		private readonly name: string,
		private readonly data: ActionData | null,
	) {
		super();
	}

	/**
	 * @description データが同じなら再描画しない
	 */
	override eq(other: XivActionWidget): boolean {
		return this.name === other.name && this.data?.iconUrl === other.data?.iconUrl;
	}

	override toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "xiv-action";

		if (this.data?.iconUrl) {
			const img = document.createElement("img");
			img.src = this.data.iconUrl;
			img.className = "xiv-action-icon";
			img.alt = "";
			img.width = 20;
			img.height = 20;
			span.appendChild(img);
		}

		const label = document.createElement("span");
		label.className = "xiv-action-label";
		label.textContent = this.name;
		span.appendChild(label);

		if (this.data) {
			const tooltip = document.createElement("div");
			tooltip.className = "xiv-tooltip";

			const nameEl = document.createElement("div");
			nameEl.className = "xiv-tooltip-name";
			nameEl.textContent = this.data.displayName;
			tooltip.appendChild(nameEl);

			if (this.data.description) {
				const descEl = document.createElement("div");
				descEl.className = "xiv-tooltip-desc";
				descEl.textContent = this.data.description;
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
				window.open(`${GARLAND_BASE}/${this.data!.id}`, "_blank");
			});
		}

		return span;
	}

	override ignoreEvent(): boolean {
		return false;
	}
}

/**
 * @description Live PreviewモードでFF14アクションを装飾するCM6 ViewPlugin。
 * カーソルが `{...}` の範囲内にある間はraw表示に戻す。
 *
 * @param cache - アクションデータのキャッシュ
 * @returns CM6拡張
 */
export function createLivePreviewExtension(cache: ActionCache) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, cache);
			}

			update(update: ViewUpdate): void {
				const hasDataLoaded = update.transactions.some((tr) =>
					tr.effects.some((e) => e.is(dataLoadedEffect)),
				);
				if (update.docChanged || update.viewportChanged || update.selectionSet || hasDataLoaded) {
					this.decorations = buildDecorations(update.view, cache);
				}
			}
		},
		{ decorations: (v) => v.decorations },
	);
}

function buildDecorations(view: EditorView, cache: ActionCache): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const selRanges = view.state.selection.ranges;

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		ACTION_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = ACTION_PATTERN.exec(text)) !== null) {
			const start = from + match.index;
			const end = start + match[0].length;
			const name = match[1] ?? "";

			// カーソルが範囲内にある間はraw表示を維持
			if (selRanges.some((r) => r.from <= end && r.to >= start)) continue;

			const cached = cache.getCached(name);

			if (cached === undefined) {
				cache.prefetch(name, () => {
					view.dispatch({ effects: dataLoadedEffect.of(undefined) });
				});
			}

			builder.add(
				start,
				end,
				Decoration.replace({
					widget: new XivActionWidget(name, cached ?? null),
				}),
			);
		}
	}

	return builder.finish();
}
