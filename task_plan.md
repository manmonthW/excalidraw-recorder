# Timeline + Motion Zoom Editor — Task Plan

## Goal
实现类似 Screen Studio / FocuSee 的时间轴编辑器 + 2D Zoom 动效功能。
用户录制完成后可在时间轴上添加多个 Zoom 关键帧，预览时实时看到缓入/缓出放大效果，导出时烧录到视频。

## Architecture Overview

```
录制 → VideoPreview（时间轴编辑器）→ 导出
                ↓
         Timeline 组件
         ├── 时间刻度尺 + 播放头
         ├── Screen 轨道（视频缩略图）
         └── Motion 轨道（Zoom 关键帧色块）
                ↓
         motionEngine.ts（插值引擎）
                ↓
         videoUtils.ts（导出引擎）
```

## File Map

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/motionEngine.ts` | ZoomKeyframe 类型 + getTransformAtTime() 插值 | ✅ |
| `src/components/Timeline.tsx` | 时间轴容器（刻度尺+播放头+轨道） | ✅ |
| `src/components/MotionTrack.tsx` | Motion 轨道（keyframe 色块+拖拽） | ✅ |
| `src/components/ZoomEditor.tsx` | Zoom 属性编辑弹窗 | ✅ |
| `src/components/VideoPreview.tsx` | 改造：集成时间轴+实时zoom预览 | ✅ |
| `src/lib/videoUtils.ts` | 改造：trimVideo 支持 keyframes[] | ✅ |
| `src/App.tsx` | 改造：传递 keyframes 状态 | ✅ |

---

## Phase 1: Data Model & Interpolation Engine `status: complete`

### Steps
- [ ] 1.1 创建 `src/lib/motionEngine.ts`
  - 定义 `ZoomKeyframe` 接口
  - 定义 `MotionTransform` 输出接口
  - 实现 `easeInOutCubic()` 缓动函数
  - 实现 `getTransformAtTime(t, keyframes[])` 核心插值函数
  - 实现 `createDefaultKeyframe(atSec, duration)` 工厂函数

### Acceptance Criteria
- getTransformAtTime 在无 keyframe 时返回 scale=1
- 在 keyframe 区间内返回正确的 scale/center
- easeIn/easeOut 阶段返回平滑过渡值

---

## Phase 2: Timeline UI `status: complete`

### Steps
- [ ] 2.1 创建 `Timeline.tsx` — 时间轴容器
  - 时间刻度尺（每秒一个刻度，每 5 秒标注数字）
  - 播放头（红色竖线），可拖拽
  - Screen 轨道（纯色条，显示视频时长）
  - 预留 Motion 轨道插槽
- [ ] 2.2 创建 `MotionTrack.tsx` — Motion 轨道
  - 渲染 keyframe 色块（蓝色/紫色，显示 "2x" 标签）
  - 色块拖拽移动
  - 色块左右边缘拖拽调整时长
  - 点击空白区域 → "Add Motion" 菜单
  - 选中色块高亮
- [ ] 2.3 创建 `ZoomEditor.tsx` — 属性编辑面板
  - Scale 滑块（1x ~ 4x）
  - Center X/Y 显示
  - EaseIn / EaseOut 时长滑块
  - Delete 按钮
- [ ] 2.4 改造 `VideoPreview.tsx`
  - 替换现有 trim 滑块 → 使用 Timeline 组件
  - 管理 keyframes 状态（useState）
  - 播放头位置 ↔ video.currentTime 双向同步

### Acceptance Criteria
- 时间轴正确显示视频时长
- 播放头可拖动并同步视频位置
- 可添加/移动/调整 zoom 色块
- 属性面板可编辑 zoom 参数

---

## Phase 3: Realtime Preview `status: complete`

### Steps
- [ ] 3.1 预览时应用 zoom 动画
  - 播放/拖动时调用 getTransformAtTime()
  - 用 CSS transform + transformOrigin 实时渲染
  - RAF 循环更新（不用 CSS transition）
- [ ] 3.2 选点模式
  - 选中 keyframe → 视频预览进入十字光标模式
  - 点击视频 → 设置 centerX/centerY
  - 实时更新预览

### Acceptance Criteria
- 播放到 zoom 区间时画面平滑放大
- 离开 zoom 区间时平滑缩小
- 点击视频可设置 zoom 中心点

---

## Phase 4: Export Engine `status: complete`

### Steps
- [ ] 4.1 改造 `videoUtils.ts` trimVideo
  - 接收 `ZoomKeyframe[]` 参数
  - 逐帧调用 getTransformAtTime() 计算 drawImage 参数
  - 在 zoom 区间内裁切放大，在普通区间全画面渲染
- [ ] 4.2 改造 `App.tsx` 数据流
  - VideoPreview 回传 keyframes[] 给 App
  - handleExport 传递 keyframes 给 trimVideo

### Acceptance Criteria
- 导出视频在 zoom 区间内正确放大
- 放大有缓入缓出效果
- 非 zoom 区间保持原始画面

---

## Phase 5: Enhancements (Optional) `status: not_started`

- [ ] 5.1 Split 分割功能
- [ ] 5.2 视频缩略图条
- [ ] 5.3 音量控制
- [ ] 5.4 多个 motion 类型（3D Transform 等）

---

## Decisions Log

| # | Decision | Reason |
|---|----------|--------|
| 1 | 用 CSS transform 做预览，drawImage 做导出 | 预览性能好，导出精确 |
| 2 | captureStream(30) 而非 captureStream(0) | 兼容性更好 |
| 3 | 先做静态时间轴，再加拖拽交互 | 降低复杂度 |
| 4 | 不引入第三方拖拽库 | 减少依赖 |

## Errors & Lessons

| # | Error | Root Cause | Fix |
|---|-------|------------|-----|
| 1 | 导出无 zoom 效果 | finally 中过早释放 URL | 改为 await Promise 后再清理 |
| 2 | captureStream(0) 不工作 | requestFrame() 兼容性 | 改用 captureStream(30) |
| 3 | 离屏 canvas 不渲染 | 浏览器优化跳过 | 插入 DOM hidden 容器 |
