import { Plugin } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";

import { ActionCache } from "./xivapi";
import { createLivePreviewExtension } from "./livepreview";
import { populateActionSpan } from "./dom";
import type { Part } from "./types";

/**
 * @description マークダウン中のアクション構文を検出する正規表現
 */
const ACTION_PATTERN = /\{([^}]+)\}/g;

/**
 * @description テキストノード走査をスキップするHTMLタグ名セット
 */
const SKIP_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "A"]);

/**
 * @description FFXIVアクションのアイコンとツールチップをObsidianに統合するプラグイン
 */
export default class XivTooltipPlugin extends Plugin {
	private readonly cache = new ActionCache();

	/**
	 * @description Obsidianプラグインのロードエントリポイント
	 */
	override async onload(): Promise<void> {
		this.registerMarkdownPostProcessor(this.processElement.bind(this));
		this.registerEditorExtension(createLivePreviewExtension(this.cache));
	}

	/**
	 * @description プラグインアンロード時にキャッシュを破棄する
	 */
	override onunload(): void {
		this.cache.clear();
	}

	/**
	 * @description 処理対象HTMLを受け取り、内包するテキストノードを変換する
	 * @param element - 走査対象の要素
	 */
	private processElement(element: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
		for (const node of this.collectTextNodes(element)) {
			this.processTextNode(node);
		}
	}

	/**
	 * @description CODEなど特定タグの内部を除外しつつテキストノードを収集する
	 * @param root - 走査起点
	 * @returns テキストノードのリスト
	 */
	private collectTextNodes(root: HTMLElement): Text[] {
		const nodes: Text[] = [];
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: (node: Node) => {
				let el = node.parentElement;
				while (el) {
					if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
					el = el.parentElement;
				}
				return NodeFilter.FILTER_ACCEPT;
			},
		});
		for (;;) {
			const node = walker.nextNode();
			if (!node) break;
			nodes.push(node as Text);
		}
		return nodes;
	}

	/**
	 * @description テキストノードをアクションspanとテキストノードに分割して置換する
	 * @param textNode - 処理対象のテキストノード
	 */
	private processTextNode(textNode: Text): void {
		const text = textNode.textContent ?? "";
		const parts: Part[] = [];
		let lastIndex = 0;
		ACTION_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = ACTION_PATTERN.exec(text)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
			}
			parts.push({ type: "action", name: match[1] ?? "" });
			lastIndex = ACTION_PATTERN.lastIndex;
		}
		if (lastIndex < text.length) {
			parts.push({ type: "text", content: text.slice(lastIndex) });
		}

		if (parts.every((p) => p.type === "text")) return;

		const fragment = document.createDocumentFragment();
		for (const part of parts) {
			if (part.type === "text") {
				fragment.appendChild(document.createTextNode(part.content));
			} else {
				const span = this.createPlaceholder(part.name);
				fragment.appendChild(span);
				void this.fetchAndUpdate(part.name, span);
			}
		}
		textNode.parentNode?.replaceChild(fragment, textNode);
	}

	/**
	 * @description データ取得完了まで表示するローディング状態のspan要素を生成する
	 * @param name - アクション名
	 * @returns ローディングクラス付きspan
	 */
	private createPlaceholder(name: string): HTMLSpanElement {
		const span = document.createElement("span");
		span.className = "xiv-action xiv-action-loading";
		span.textContent = name;
		return span;
	}

	/**
	 * @description キャッシュからアクションデータを取得してspanを更新する
	 * @param name - アクション名
	 * @param span - 更新対象のspan要素
	 */
	private async fetchAndUpdate(name: string, span: HTMLSpanElement): Promise<void> {
		try {
			const data = await this.cache.get(name);
			span.classList.remove("xiv-action-loading");
			if (!data) return;

			span.empty();
			populateActionSpan(span, name, data);
		} catch (err) {
			console.warn(`[xiv-tooltip] Failed to load "${name}":`, err);
			span.classList.remove("xiv-action-loading");
		}
	}
}
