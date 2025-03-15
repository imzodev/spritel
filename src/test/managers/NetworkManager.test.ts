import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NetworkManager } from '../../managers/NetworkManager'

describe('NetworkManager', () => {
  let networkManager: NetworkManager
  let mockWebSocket: any

  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
    }

    // Mock the WebSocket constructor
    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket)

    networkManager = new NetworkManager()
  })

  it('should establish WebSocket connection on creation', () => {
    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3001')
  })

  it('should emit connect event when WebSocket opens', () => {
    const connectHandler = vi.fn()
    networkManager.addEventListener('connect', connectHandler)

    // Simulate WebSocket open event
    mockWebSocket.onopen()

    expect(connectHandler).toHaveBeenCalled()
  })

  it('should emit disconnect event when WebSocket closes', () => {
    const disconnectHandler = vi.fn()
    networkManager.addEventListener('disconnect', disconnectHandler)

    // Simulate WebSocket close event
    mockWebSocket.onclose()

    expect(disconnectHandler).toHaveBeenCalled()
  })

  it('should handle incoming messages correctly', () => {
    const messageHandler = vi.fn()
    networkManager.addEventListener('test-event', messageHandler)

    // Simulate receiving a message
    mockWebSocket.onmessage({
      data: JSON.stringify({
        type: 'test-event',
        data: { foo: 'bar' }
      })
    })

    expect(messageHandler).toHaveBeenCalled()
  })
})