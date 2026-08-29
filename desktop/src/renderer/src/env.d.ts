import type { OrbiDesktopApi } from "../../shared/contracts";

declare global {
  interface Window {
    orbi: OrbiDesktopApi;
  }
}

export {};
