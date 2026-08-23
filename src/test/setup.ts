import '@testing-library/jest-dom'

// jsdom не предоставляет полноценный Canvas 2D контекст; для core-тестов,
// создающих CanvasEngine, подменяем getContext('2d') на базовый мок.
if (typeof HTMLCanvasElement !== 'undefined') {
  const canvasProto = HTMLCanvasElement.prototype
  const origGetContext = canvasProto.getContext

  function createMockContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    return {
      canvas,
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      arc: () => {},
      arcTo: () => {},
      bezierCurveTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0 }),
      setTransform: () => {},
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      transform: () => {},
      scale: () => {},
      rotate: () => {},
      translate: () => {},
      setLineDash: () => {},
      getLineDash: () => [],
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => null,
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
      putImageData: () => {},
      drawImage: () => {},
      clip: () => {},
      isPointInPath: () => false,
      isPointInStroke: () => false,
    } as unknown as CanvasRenderingContext2D
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(canvasProto as any).getContext = function (this: HTMLCanvasElement, contextId: string, options?: unknown) {
    if (contextId === '2d') {
      const real = origGetContext.call(this, contextId, options) as CanvasRenderingContext2D | null
      return real ?? createMockContext(this)
    }
    return origGetContext.call(this, contextId, options)
  }
}
