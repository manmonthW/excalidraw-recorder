# Findings — Timeline Zoom Editor

## 现有代码结构发现

### VideoPreview.tsx 现状
- 接收 blob, onTrimChange, onZoomChange, onClose
- 有 trimStart/trimEnd 滑块
- 有 zoom 模式（zoomMode state + CSS transform 预览）
- 需要完全重构：滑块 → Timeline 组件

### videoUtils.ts 现状
- trimVideo() 已支持 ZoomRegion（单个静态 zoom）
- 使用 canvas.captureStream(30) + MediaRecorder 重编码
- 核心循环：RAF → drawImage → captureStream 被动捕获
- **关键教训**：video + canvas 必须插入 DOM（hidden），否则部分浏览器跳过渲染

### App.tsx 数据流
- recording (RecordingResult | null) → 录制结果
- trimRange ({ startMs, endMs } | null) → 裁剪范围
- zoomRegion (ZoomRegion | null) → zoom 参数（将被 keyframes[] 替代）
- showPreview → 控制 VideoPreview 显示
- handleExport → 调用 trimVideo + convertToMp4

### useRecorder.ts
- 不需要改动，录制阶段与后期编辑解耦

## Screen Studio 功能分析（来自截图）

### UI 结构
- 顶部工具栏：Crop Screen | Templates | Save | Export
- 中间：视频预览（带实时 zoom 效果）
- 底部：多轨道时间轴
  - Screen 轨道：缩略图条 + 音量
  - Motion 轨道：zoom/3D 色块
  - Sticker 轨道

### 2D Zoom 实现原理
- 在 Motion 轨道上创建时间区间
- 每个区间有：centerX, centerY, scale, easeIn, easeOut
- 导出时逐帧插值 drawImage 的源矩形参数
- 预览时用 CSS transform 实时渲染

## 技术决策依据

### captureStream(30) vs captureStream(0)
- captureStream(0) 需要手动 requestFrame()，CanvasCaptureMediaStreamTrack 不是所有浏览器都有
- captureStream(30) 被动轮询，兼容性好，但帧率固定
- 结论：用 30

### CSS transform 预览 vs canvas 预览
- CSS transform：性能极好，不需要额外 canvas，但只适合简单的缩放/位移
- Canvas 重绘：精确，但 60fps 实时重绘开销大
- 结论：预览用 CSS transform，导出用 canvas drawImage

### 不引入拖拽库的原因
- 只需要水平拖拽（时间轴轨道）
- 原生 mousedown/mousemove/mouseup 足够
- 避免增加 bundle 大小
