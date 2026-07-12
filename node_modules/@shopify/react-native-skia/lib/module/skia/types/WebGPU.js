/**
 * Make the WebGPU flag constants (`GPUBufferUsage`, `GPUColorWrite`,
 * `GPUMapMode`, `GPUShaderStage`, `GPUTextureUsage`) available on the runtime
 * that calls this.
 *
 * The native module installs these globals on the main JS runtime, but worklet
 * runtimes (Reanimated UI, dedicated worklet runtimes, Vision Camera frame
 * processors) start without them, so referencing the bare global inside a
 * worklet yields `undefined`. Call `installWebGPU()` once at the top of a
 * worklet to install them there:
 *
 * ```tsx
 * import { installWebGPU } from "@shopify/react-native-skia";
 *
 * const work = (device: GPUDevice) => {
 *   "worklet";
 *   installWebGPU();
 *   device.createBuffer({
 *     usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
 *   });
 * };
 * ```
 *
 * `installWebGPU` is a native host function. When captured into a worklet, the
 * Worklets serializer re-creates it on the worklet runtime, so calling it there
 * installs the constants on that runtime. The values come from the native
 * `wgpu::*Usage` enums, so they stay a single source of truth across runtimes.
 * Calling it on a runtime that already has the constants is a safe no-op, and on
 * web (where the constants are always global) it is a no-op too.
 */
export const installWebGPU = (() => {
  const g = typeof global !== "undefined" ? global : undefined;
  return g && typeof g.installWebGPU === "function" ? g.installWebGPU : () => {};
})();

// Skia's Graphite/Dawn backend extends the standard WebGPU API (typed by
// @webgpu/types) with a few Skia- and Dawn-specific entry points. These are
// only available on native (SK_GRAPHITE) builds, reachable through
// `Skia.getDevice()`.
//
// The exported interfaces below describe the descriptors and objects those
// entry points use; the `declare global` block augments the standard WebGPU
// interfaces so the new methods are typed without casting to `any`.

/**
 * Descriptor for {@link GPUDevice.importExternalTexture} when the source is a
 * Skia NativeBuffer (Skia has no WebCodecs `VideoFrame`).
 *
 * `source` is the handle returned by `Skia.NativeBuffer.MakeFromImage`: a
 * `CVPixelBufferRef` on Apple, an `AHardwareBuffer*` on Android. The caller
 * owns its lifetime (release it with `Skia.NativeBuffer.Release`) and must keep
 * it alive until the imported texture is destroyed.
 */

/**
 * Descriptor for {@link GPUDevice.importSharedTextureMemory}. `handle` is the
 * NativeBuffer returned by `Skia.NativeBuffer.MakeFromImage` (see
 * {@link SkiaGPUExternalTextureDescriptor} for the platform-specific types and
 * lifetime rules).
 */

/**
 * The kind of native synchronization primitive a {@link GPUSharedFence} wraps,
 * matching the `shared-fence-*` device feature names. Limited to the kinds
 * react-native-skia targets (iOS/Metal and Android/Vulkan); `importSharedFence`
 * accepts these and `export()` reports them.
 */

/**
 * Descriptor for {@link GPUDevice.importSharedFence}.
 */

/**
 * A native GPU synchronization primitive shared across queues/APIs. Produced by
 * {@link GPUSharedTextureMemory.endAccess}, consumed by
 * {@link GPUSharedTextureMemory.beginAccess}, or imported from a consumer's
 * fence with {@link GPUDevice.importSharedFence}.
 */

/** A fence and the timeline value to wait for (0n for binary sync-fd fences). */

/**
 * The result of {@link GPUSharedTextureMemory.endAccess}: each fence is signaled
 * at its `signaledValue` once Dawn's GPU work for the access completes.
 */

/**
 * Shared texture memory imported from a platform native buffer via
 * {@link GPUDevice.importSharedTextureMemory}. Create a texture that aliases
 * the memory, then bracket the GPU work that touches it with
 * {@link GPUSharedTextureMemory.beginAccess} / {@link GPUSharedTextureMemory.endAccess}.
 */

/**
 * Dawn-specific toggles, passed via {@link GPUDeviceDescriptor.dawnToggles} to
 * `adapter.requestDevice`. This is a non-spec, Dawn-only extension; see Dawn's
 * toggle list for valid names.
 */
//# sourceMappingURL=WebGPU.js.map