import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";

import { populateActionSpan } from "./dom";
import type { ActionCache } from "./xivapi";
import type { ActionData } from "./types";

/**
 * @description マークダウン中のアクション構文を検出する正規表現
 */
const ACTION_PATTERN = /\{([^\n}]+)\}/g;

/**
 * @description データ読み込み完了をViewPluginに通知するStateEffect
 */
export const dataLoadedEffect = StateEffect.define<void>();

/**
 * @description Live PreviewでFFXIVアクションを表示するCM6ウィジェット
 */
class XivActionWidget extends WidgetType {
	/**
	 * @param name - アクション名
	 * @param data - アクションデータ。未取得時はnull @optional
	 */
	constructor(
		private readonly name: string,
		private readonly data: ActionData | null,
	) {
		super();
	}

	/**
	 * @description name・iconUrlが同一なら再描画不要と判断する
	 */
	override eq(other: XivActionWidget): boolean {
		return this.name === other.name && this.data?.iconUrl === other.data?.iconUrl;
	}

	/**
	 * @description span要素を生成しアクション表示を構築する
	 */
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

	/**
	 * @description クリックイベントをウィジェットに渡す
	 */
	override ignoreEvent(): boolean {
		return false;
	}
}

/**
 * @description カーソルが{...}範囲内にある間はraw表示に戻すLive Preview用CM6拡張を生成する
 * @param cache - アクションデータのキャッシュ
 * @returns CM6 ViewPlugin拡張
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

/**
 * @description カーソル範囲外の{...}パターンをウィジェットDecorationに置換するDecorationSetを構築する
 * @param view - 操作対象のEditorView
 * @param cache - アクションデータのキャッシュ
 * @returns 構築済みDecorationSet
 */
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
