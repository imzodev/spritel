import '@testing-library/jest-dom'
import { vi } from 'vitest'
import './mocks/phaser'

// Mock canvas
const mockCanvas = {
  getContext: () => ({
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1
    }),
    createImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1
    })
  }),
  toDataURL: vi.fn(),
  width: 400,
  height: 300,
}

if (typeof window !== 'undefined') {
  // Mock WebSocket
  window.WebSocket = class MockWebSocket {
    onopen: () => void = () => {}
    onmessage: (event: any) => void = () => {}
    onclose: () => void = () => {}
    send: (data: any) => void = () => {}
    close: () => void = () => {}
  } as any

  // Mock HTMLCanvasElement
  window.HTMLCanvasElement.prototype.getContext = function(contextId: string) {
    if (contextId === '2d') {
      return mockCanvas.getContext() as CanvasRenderingContext2D;
    }
    return null;
  } as typeof window.HTMLCanvasElement.prototype.getContext;

  // Mock window properties used by Phaser
  Object.defineProperty(window, 'devicePixelRatio', { value: 1 })
}
