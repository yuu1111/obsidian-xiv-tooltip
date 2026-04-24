import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";

import { populateActionSpan } from "./dom";
import type { ActionCache } from "./xivapi";
import type { ActionData } from "./types";

const ACTION_PATTERN = /\{([^}]+)\}/g;

/**
 * データ読み込み完了を通知する StateEffect。
 * CM6 の ViewPlugin.update() でこのエフェクトを検出して装飾を再構築する。
 */
export const dataLoadedEffect = StateEffect.define<void>();

class XivActionWidget extends WidgetType {
	constructor(
		private readonly name: string,
		private readonly data: ActionData | null,
	) {
		super();
	}

	override eq(other: XivActionWidget): boolean {
		return this.name === other.name && this.data?.iconUrl === other.data?.iconUrl;
	}

	override toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "xiv-action";
		if (this.data) populateActionSpan(span, this.name, this.data);
		else {
			const label = document.createElement("span");
			label.className = "xiv-action-label";
			label.textContent = this.name;
			span.appendChild(label);
		}
		return span;
	}

	override ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Live Preview モードで FF14 アクションを装飾する CM6 ViewPlugin。
 * カーソルが `{...}` の範囲内にある間は raw 表示に戻す。
 *
 * @param cache - アクションデータのキャッシュ
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

			if (selRanges.some((r) => r.from <= end && r.to >= start)) continue;

			const cached = cache.getCached(name);

			if (cached === undefined) {
				// 破棄済みビューへのdispatchを防ぐため isConnected を確認する
				cache.prefetch(name, () => {
					if (view.dom.isConnected) {
						view.dispatch({ effects: dataLoadedEffect.of(undefined) });
					}
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
