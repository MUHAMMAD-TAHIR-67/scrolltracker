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
export const installWebGPU: any;
