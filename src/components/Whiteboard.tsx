import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";

// Excalidraw styles (required for proper rendering)
import "@excalidraw/excalidraw/index.css";

// Excalidraw types
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Dynamic import to avoid SSR issues
let ExcalidrawComponent: ForwardRefExoticComponent<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any & RefAttributes<ExcalidrawImperativeAPI>
> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MainMenuComponent: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MainMenuItemComponent: any = null;

interface WhiteboardProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isRecording: boolean;
}

export function Whiteboard({ canvasRef, isRecording }: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const rafRef = useRef<number>(0);

  // Load Excalidraw dynamically
  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      ExcalidrawComponent = mod.Excalidraw as unknown as typeof ExcalidrawComponent;
      MainMenuComponent = mod.MainMenu;
      MainMenuItemComponent = mod.MainMenu.Item;
      setLoaded(true);
    }).catch((err) => {
      console.error("Failed to load Excalidraw:", err);
    });
  }, []);

  // Mirror excalidraw's internal canvas to our recording canvas
  const syncCanvas = useCallback(() => {
    const container = containerRef.current;
    const target = canvasRef.current;
    if (!container || !target) return;

    // Find the excalidraw canvas inside the container
    const sourceCanvas = container.querySelector<HTMLCanvasElement>(
      ".excalidraw canvas"
    );
    if (!sourceCanvas) return;

    // Match dimensions
    if (
      target.width !== sourceCanvas.width ||
      target.height !== sourceCanvas.height
    ) {
      target.width = sourceCanvas.width;
      target.height = sourceCanvas.height;
    }

    const ctx = target.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(sourceCanvas, 0, 0);
    }
  }, [canvasRef]);

  // Continuously sync canvas when recording
  useEffect(() => {
    if (!isRecording) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = () => {
      syncCanvas();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording, syncCanvas]);

  if (!loaded || !ExcalidrawComponent) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#666",
          fontSize: 18,
        }}
      >
        Loading Excalidraw...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <ExcalidrawComponent
        theme="light"
        UIOptions={{
          canvasActions: {},
        }}
      >
        {MainMenuComponent && MainMenuItemComponent && (
          <MainMenuComponent>
            <MainMenuComponent.DefaultItems.SaveAsImage />
            <MainMenuComponent.DefaultItems.Export />
            <MainMenuComponent.DefaultItems.LoadScene />
            <MainMenuComponent.DefaultItems.ClearCanvas />
            <MainMenuComponent.DefaultItems.ToggleTheme />
            <MainMenuComponent.DefaultItems.ChangeCanvasBackground />
            <MainMenuComponent.DefaultItems.Help />
          </MainMenuComponent>
        )}
      </ExcalidrawComponent>
      {/* Hidden canvas for recording capture */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          opacity: 0,
          width: 0,
          height: 0,
        }}
      />
    </div>
  );
}
