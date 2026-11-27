import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import api from '../api/axiosInstance'
import { notifyCartUpdated } from '../context/ToastContext'

/**
 * Floating AI customer support chat widget.
 * Shows on every page (rendered in App.jsx).
 * Positioned above MobileBottomNav on mobile screens.
 */
export default function ChatWidget() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  const [isOpen, setIsOpen]       = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const bottomRef                 = useRef(null)

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: "Hi! I'm your actionable shopping assistant. I can track your live orders, check active coupons, inspect your cart, or even add items to your cart!"
      }])
    }
  }

  const sendMessage = async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
    if (!text || loading) return

    setMessages(prev => [...prev, { role: 'user', text }])
    if (typeof overrideText !== 'string') setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/chat/message', {
        sessionId,
        message: text,
      })
      setSessionId(data.sessionId)
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }])
      if (/added.*cart/i.test(data.reply || '')) {
        notifyCartUpdated()
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "Sorry, I'm having trouble right now. Please try again or email support@ordermanagement.com."
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // On customer mobile views, MobileBottomNav is fixed at bottom-0 (h-16 = 64px).
  // Place the chat button and window cleanly above it.
  const fabPositionCls = isAdminRoute
    ? 'bottom-5 right-4 md:bottom-6 md:right-6'
    : 'bottom-20 right-4 md:bottom-6 md:right-6'

  const windowPositionCls = isAdminRoute
    ? 'bottom-20 right-3 left-3 sm:left-auto sm:w-[360px] md:bottom-[90px] md:right-6'
    : 'bottom-[144px] right-3 left-3 sm:left-auto sm:w-[360px] md:bottom-[90px] md:right-6'

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed ${windowPositionCls} z-50 h-[min(460px,calc(100dvh-210px))] md:h-[480px] rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden`}
        >
          {/* Header */}
          <div className="bg-[var(--primary)] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="w-4 h-4" />
              <span>Shopping Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 bg-[var(--bg)]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={
                    msg.role === 'user'
                      ? 'bg-[var(--primary)] text-white px-3 py-2 rounded-2xl rounded-br-sm max-w-[82%] text-[13px] leading-relaxed'
                      : 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-3 py-2 rounded-2xl rounded-bl-sm max-w-[85%] text-[13px] leading-relaxed'
                  }
                >
                  {msg.text.split('\n').map((line, j, arr) => (
                    <span key={j}>
                      {line}
                      {j < arr.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] px-3 py-2 rounded-2xl rounded-bl-sm text-xs tracking-widest animate-pulse">
                  ● ● ●
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Actionable Chips */}
          <div className="px-2.5 py-2 border-t border-[var(--border)] bg-[var(--bg)] flex items-center gap-1.5 overflow-x-auto">
            {['Track my orders', 'Active coupons', "What's in my cart?", 'Add sneakers to cart'].map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(chip)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] shrink-0 transition-colors disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-2.5 border-t border-[var(--border)] bg-[var(--surface)]">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about products, orders..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-9 h-9 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Bubble Button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        aria-label={isOpen ? 'Close shopping assistant' : 'Open shopping assistant'}
        className={`fixed ${fabPositionCls} z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[var(--primary)] text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />}
      </button>
    </>
  )
}
