import { Player } from "@kixelated/moq/playback";

/**
 * This stylesheet is self contained within the shadow root
 * If we attach the element as open in the constructor, it should inherit
 * the document's style.
 */
import STYLE_SHEET from "./video-moq.css?inline";

const PLAY_SVG = /*html*/ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff" class="h-4 w-4">
					<path d="M3 22v-20l18 10-18 10z" />
				</svg>`;
const PAUSE_SVG = /*html*/ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff" class="h-6 w-6">
					<path d="M6 5h4v14H6zM14 5h4v14h-4z" />
				</svg>`;

class VideoMoq extends HTMLElement {
	private shadow: ShadowRoot;

	// Event Handlers
	private playPauseEventHandler: (event: Event) => void;
	private onMouseEnterHandler: (event: Event) => void;
	private onMouseLeaveHandler: (event: Event) => void;
	private toggleMuteEventHandler: (event: Event) => void;
	private toggleShowTrackEventHandler: (event: Event) => void;

	// HTML Elements
	#canvas?: HTMLCanvasElement;
	#playButton?: HTMLButtonElement;
	#controls?: HTMLElement;
	#volumeButton?: HTMLButtonElement;
	#trackButton?: HTMLButtonElement;
	#trackList?: HTMLUListElement;

	// State
	private player: Player | null = null;

	get src(): string | null {
		return this.getAttribute("src");
	}

	set src(val) {
		this.setAttribute("src", `${val}`);
	}

	get controls(): string | null {
		return this.getAttribute("controls");
	}

	get muted(): boolean {
		return this.player ? this.player.muted : false;
	}

	set muted(mute: boolean) {
		if (mute) this.mute();
		else this.unmute();
	}

	get selectedTrack(): string {
		return this.player ? this.player.videoTrackName : "";
	}

	constructor() {
		super();

		// Attach Shadow DOM
		this.shadow = this.attachShadow({ mode: "open" });

		// Bind event listeners to add and remove from lists.
		this.playPauseEventHandler = this.togglePlayPause.bind(this);
		this.toggleMuteEventHandler = this.toggleMute.bind(this);

		this.onMouseEnterHandler = this.toggleShowControls.bind(this, true);
		this.onMouseLeaveHandler = this.toggleShowControls.bind(this, false);
		this.toggleShowTrackEventHandler = this.toggleShowTracks.bind(this);
	}

	/**
	 * Called when the element is first added to the DOM
	 *
	 * Here we handle attributes.
	 * Right now we support: src fingerprint controls namespace width height
	 * TODO: To be supported: autoplay muted poster
	 * @returns
	 */
	connectedCallback() {
		this.load();
	}

	/**
	 * Called when the element is removed from the DOM
	 * */
	disconnectedCallback() {
		this.destroy();
	}

	// TODO: Move attribute processing to a function and add this.
	// Called when one of the element's watched attributes change. For an attribute to be watched, you must add it to the component class's static observedAttributes property.
	// attributeChangedCallback() {}

	/**
	 * Sets the player attribute and configures info related to a successful connection
	 * */
	private setPlayer(player: Player) {
		this.player = player;

		if (!this.player.isPaused() && this.#playButton) {
			this.#playButton.innerHTML = PAUSE_SVG;
			this.#playButton.ariaLabel = "Pause";

			// TODO: Seems like I have to wait till subscriptions are done to automute and/or autoplay
			// const automute = this.getAttribute("muted");
			// if (automute !== null && automute) {
			// 	this.mute();
			// }

			// Correct the icon if not muted
			if (!this.muted && this.#volumeButton) {
				this.#volumeButton.ariaLabel = "Mute";
				this.#volumeButton.innerText = "🔊";
			}
		}
	}

	private async load() {
		this.destroy();

		this.shadow.innerHTML = /*html*/ `
			<style>${STYLE_SHEET}</style>
			<div id="base" class="relative">
				<canvas id="canvas" class="h-full w-full rounded-lg">
				</canvas>
			</div>
		`;

		const base: HTMLDivElement = this.shadow.querySelector("#base")!;
		this.#canvas = this.shadow.querySelector("canvas#canvas")!;

		if (!this.src) {
			this.error("No 'src' attribute provided for <video-moq>");
			return;
		}

		const url = new URL(this.src);

		const urlParams = new URLSearchParams(url.search);
		const namespace = urlParams.get("namespace") || this.getAttribute("namespace");
		const fingerprint = urlParams.get("fingerprint") || this.getAttribute("fingerprint");

		// TODO: Unsure if fingerprint should be optional
		if (namespace === null || fingerprint === null) return;

		// TODO: make tracknum a parameter somehow
		const trackNum = 0;
		Player.create({ url: url.origin, fingerprint, canvas: this.#canvas, namespace }, trackNum)
			.then((player) => this.setPlayer(player))
			.catch(this.error);

		if (this.controls !== null) {
			let controlsElement = document.createElement("div");
			controlsElement.innerHTML = /* html */ `
			<div id="controls" class="absolute opacity-0 bottom-4 flex h-[40px] w-full items-center gap-[4px] rounded transition-opacity duration-200" >
				<button id="play" class="absolute bottom-0 left-4 flex h-8 w-12 items-center justify-center rounded bg-black-70 px-2 py-2 shadow-lg hover:bg-black-80 focus:bg-black-100 focus:outline-none">
					${PLAY_SVG}
				</button>
				<div class="absolute bottom-0 right-4 flex h-[32px] w-fit items-center justify-evenly gap-[4px] rounded bg-black-70 p-2">
					<button id="volume" aria-label="Unmute" class="flex h-4 w-0 items-center justify-center rounded bg-transparent p-4 text-white hover:bg-black-80 focus:bg-black-80 focus:outline-none">
						🔇
					</button>
					<button id="track" aria-label="Select Track" class="flex h-4 w-0 items-center justify-center rounded bg-transparent p-4 text-white hover:bg-black-100 focus:bg-black-80 focus:outline-none">
						⚙️
					</button>
					<ul id="tracklist" class="absolute bottom-6 right-0 mt-2 w-40 rounded bg-black-80 p-0 text-white shadow-lg">
					</ul>
				</div>
			</div>`;
			base.appendChild(controlsElement.children[0]);

			this.#controls = this.shadow.querySelector("#controls")!;
			this.#playButton = this.shadow.querySelector("#play")!;
			this.#volumeButton = this.shadow.querySelector("#volume")!;
			this.#trackButton = this.shadow.querySelector("#track")!;
			this.#trackList = this.shadow.querySelector("ul#tracklist")!;

			this.#canvas.addEventListener("click", this.playPauseEventHandler);

			this.#playButton.addEventListener("click", this.playPauseEventHandler);

			this.#volumeButton.addEventListener("click", this.toggleMuteEventHandler);

			this.#canvas.addEventListener("mouseenter", this.onMouseEnterHandler);
			this.#canvas.addEventListener("mouseleave", this.onMouseLeaveHandler);
			this.#controls.addEventListener("mouseenter", this.onMouseEnterHandler);
			this.#controls.addEventListener("mouseleave", this.onMouseLeaveHandler);

			this.#trackButton.addEventListener("click", this.toggleShowTrackEventHandler);
		}

		const width = this.parseDimension(this.getAttribute("width"), -1);
		const height = this.parseDimension(this.getAttribute("height"), -1);

		if (width != -1) {
			base.style.width = width.toString() + "px";
		}
		if (height != -1) {
			base.style.height = height.toString() + "px";
		}
		const aspectRatio = this.getAttribute("aspect-ratio"); // TODO: We could also get this from the player
		if (aspectRatio !== null) {
			base.style.aspectRatio = aspectRatio.toString();
		}
	}

	private destroy() {
		this.#canvas?.removeEventListener("click", this.playPauseEventHandler);
		this.#playButton?.removeEventListener("click", this.playPauseEventHandler);

		this.#volumeButton?.removeEventListener("click", this.toggleMuteEventHandler);

		this.#canvas?.removeEventListener("mouseenter", this.onMouseEnterHandler);
		this.#canvas?.removeEventListener("mouseleave", this.onMouseLeaveHandler);
		this.#controls?.removeEventListener("mouseenter", this.onMouseEnterHandler);
		this.#controls?.removeEventListener("mouseleave", this.onMouseLeaveHandler);

		this.#trackButton?.removeEventListener("click", this.toggleShowTrackEventHandler);

		this.player?.close();
		this.player = null;
	}

	private toggleShowControls(show: boolean) {
		if (!this.#controls) return;
		if (show) {
			this.#controls.classList.add("opacity-100");
			this.#controls.classList.remove("opacity-0");
		} else {
			this.#controls.classList.add("opacity-0");
			this.#controls.classList.remove("opacity-100");
		}
	}

	// Play / Pause
	private togglePlayPause() {
		if (!this.#playButton) return;

		this.#playButton.disabled = true;

		(this.player?.isPaused() ? this.play() : this.pause()).finally(() => {
			if (!this.#playButton) return;
			this.#playButton.disabled = false;
		});
	}

	public play(): Promise<void> {
		return this.player
			? this.player.play().then(() => {
					if (!this.#playButton) return;
					this.#playButton.innerHTML = PAUSE_SVG;
					this.#playButton.ariaLabel = "Pause";
			  })
			: Promise.resolve();
	}

	public pause(): Promise<void> {
		return this.player
			? this.player.pause().then(() => {
					if (!this.#playButton) return;
					this.#playButton.innerHTML = PLAY_SVG;
					this.#playButton.ariaLabel = "Play";
			  })
			: Promise.resolve();
	}

	private toggleMute() {
		if (!this.#volumeButton) return;
		this.#volumeButton.disabled = true;
		(this.muted ? this.unmute() : this.mute()).finally(() => {
			if (!this.#volumeButton) return;
			this.#volumeButton.disabled = false;
		});
	}

	public unmute(): Promise<void> {
		return this.player
			? this.player.mute(false).then(() => {
					if (!this.#volumeButton) return;
					this.#volumeButton.ariaLabel = "Mute";
					this.#volumeButton.innerText = "🔊";
			  })
			: Promise.resolve();
	}

	public mute(): Promise<void> {
		return this.player
			? this.player.mute(true).then(() => {
					if (!this.#volumeButton) return;
					this.#volumeButton.ariaLabel = "Unmute";
					this.#volumeButton.innerText = "🔇";
			  })
			: Promise.resolve();
	}

	#showTracks = false;
	private toggleShowTracks() {
		if (!this.#trackList) return;
		this.#showTracks = !this.#showTracks;

		if (this.#showTracks) {
			if (this.player) {
				const options = this.player.getVideoTracks();
				this.#trackList.innerHTML = options
					.map((option) => {
						return /*html*/ `<li role="menuitem" tabIndex={0} data-name=${option}
				class="flex w-full items-center justify-between px-4 py-2 hover:bg-black-100 cursor-pointer
				 ${this.selectedTrack === option ? "bg-blue-500 text-white" : ""}"
				 >
				 <span>${option}</span>
				 </li>`;
					})
					.join("");
				this.#trackList.querySelectorAll("li").forEach((element) => {
					element.addEventListener("click", () => this.switchTrack(element.dataset.name || null));
					element.addEventListener("keydown", (e) => {
						if (e.key === "Enter" || e.key === " ") {
							this.switchTrack(element.dataset.name || null);
						}
					});
				});
			} else {
				this.#trackList.innerHTML = /*html*/ `<li class="flex w-full items-center justify-between cursor-not-allowed px-4 py-2 text-gray-500"><span>No options available</span></li>`;
			}
		} else {
			this.#trackList.innerHTML = "";
		}
	}

	private switchTrack(name: string | null) {
		if (name === null) {
			this.error("Could not recognize selected track name");
			return;
		}

		this.player?.switchTrack(name);
	}

	private parseDimension(value: string | null, defaultValue: number): number {
		if (!value) {
			return defaultValue;
		}

		const parsed = parseInt(value, 10);

		// Check for NaN or negative values
		if (isNaN(parsed) || parsed <= 0) {
			console.warn(`Invalid value "${value}" for dimension, using default: ${defaultValue}px`);
			return defaultValue;
		}

		return parsed;
	}

	// TODO: (?) Handle Stream ended event. May not be necessary, it came w/ the example.
	// private onStreamEnded() {
	// 	this.#playButton.disabled = false;
	// }

	/* Right now we are just printing errors, but we could
	display them on the canvas if we want */
	private error(msg: any) {
		console.error(msg);
	}
}

// Register the custom element
customElements.define("video-moq", VideoMoq);
export default VideoMoq;
