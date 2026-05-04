/// <reference types="vite/client" />

// Excalidraw module declaration
declare module "@excalidraw/excalidraw" {
  import type { ForwardRefExoticComponent, RefAttributes } from "react";
  
  export interface ExcalidrawImperativeAPI {
    getSceneElements: () => unknown[];
    getAppState: () => unknown;
    resetScene: () => void;
    updateScene: (scene: unknown) => void;
  }
  
  export const Excalidraw: ForwardRefExoticComponent<
    Record<string, unknown> & RefAttributes<ExcalidrawImperativeAPI>
  >;
}

declare module "@excalidraw/excalidraw/types" {
  export interface ExcalidrawImperativeAPI {
    getSceneElements: () => unknown[];
    getAppState: () => unknown;
    resetScene: () => void;
    updateScene: (scene: unknown) => void;
  }
}

// Canvas captureStream API
interface HTMLCanvasElement {
  captureStream(frameRate?: number): MediaStream;
}
