import { Plugin } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";

import { ActionCache } from "./xivapi";
import type { ActionData } from "./types";

const ACTION_PATTERN = /\{([^}]+)\}/g;
const SKIP_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "A"]);
const GARLAND_BASE = "https://garlandtools.org/db/#action";

export default class XivTooltipPlugin extends Plugin {
	private readonly cache = new ActionCache();

	override async onload(): Promise<void> {
		this.registerMarkdownPostProcessor(this.processElement.bind(this));
	}

	override onunload(): void {
		this.cache.clear();
	}

	private processElement(element: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
		for (const node of this.collectTextNodes(element)) {
			ACTION_PATTERN.lastIndex = 0;
			if (ACTION_PATTERN.test(node.textContent ?? "")) {
				this.processTextNode(node);
			}
		}
	}

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

	private processTextNode(textNode: Text): void {
		const text = textNode.textContent ?? "";
		type Part = { type: "text"; content: string } | { type: "action"; name: string };
		const parts: Part[] = [];
		let lastIndex = 0;
		const pattern = /\{([^}]+)\}/g;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(text)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
			}
			parts.push({ type: "action", name: match[1] ?? "" });
			lastIndex = pattern.lastIndex;
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

	private createPlaceholder(name: string): HTMLSpanElement {
		const span = document.createElement("span");
		span.className = "xiv-action xiv-action-loading";
		span.textContent = name;
		return span;
	}

	private async fetchAndUpdate(name: string, span: HTMLSpanElement): Promise<void> {
		try {
			const data = await this.cache.get(name);
			span.classList.remove("xiv-action-loading");
			if (!data) return;

			span.empty();

			if (data.iconUrl) {
				const img = span.createEl("img", { cls: "xiv-action-icon" });
				img.src = data.iconUrl;
				img.alt = "";
				img.loading = "lazy";
			}

			span.createEl("span", { cls: "xiv-action-label", text: name });
			this.appendTooltip(span, data);

			span.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(`${GARLAND_BASE}/${data.id}`, "_blank");
			});
		} catch (err) {
			console.warn(`[xiv-tooltip] Failed to load "${name}":`, err);
			span.classList.remove("xiv-action-loading");
		}
	}

	private appendTooltip(parent: HTMLSpanElement, data: ActionData): void {
		const tooltip = parent.createEl("div", { cls: "xiv-tooltip" });
		tooltip.createEl("div", { cls: "xiv-tooltip-name", text: data.displayName });
		if (data.description) {
			tooltip.createEl("div", { cls: "xiv-tooltip-desc", text: data.description });
		}
		tooltip.createEl("div", { cls: "xiv-tooltip-hint", text: "クリックで詳細を開く" });
	}
}
