import { useState, useEffect, useRef } from 'react'
import api from '../api/axiosInstance'

/**
 * Floating AI customer support chat widget.
 * Shows on every page (rendered in App.jsx).
 * Maintains conversation history via sessionId stored in component state.
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen]       = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const bottomRef                 = useRef(null)

  // Scroll to latest message whenever messages update
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  // Show welcome message when chat is opened for the first time
  const handleOpen = () => {
    setIsOpen(true)
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: "👋 Hi! I'm your shopping assistant. How can I help you today?\n\nYou can ask me about products, orders, payments, returns, or anything else!"
      }])
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    // Show user message immediately
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/chat/message', {
        sessionId,
        message: text,
      })
      setSessionId(data.sessionId)
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }])
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

  return (
    <>
      {/* ── Chat Window ───────────────────────────────── */}
      {isOpen && (
        <div style={styles.window}>
          {/* Header */}
          <div style={styles.header}>
            <span>🤖 Shopping Assistant</span>
            <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>✕</button>
          </div>

          {/* Messages */}
          <div style={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} style={msg.role === 'user' ? styles.userRow : styles.botRow}>
                <div style={msg.role === 'user' ? styles.userBubble : styles.botBubble}>
                  {msg.text.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < msg.text.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={styles.botRow}>
                <div style={styles.botBubble}>
                  <span style={styles.dots}>●&nbsp;●&nbsp;●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={styles.inputRow}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              style={styles.textarea}
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} style={styles.sendBtn}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Bubble Button ─────────────────────── */}
      <button onClick={isOpen ? () => setIsOpen(false) : handleOpen} style={styles.fab}>
        {isOpen ? '✕' : '💬'}
      </button>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  fab: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
  },
  window: {
    position: 'fixed',
    bottom: '90px',
    right: '24px',
    width: '340px',
    height: '480px',
    background: '#1e1e2e',
    borderRadius: '16px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9998,
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '16px',
    padding: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  botRow:  { display: 'flex', justifyContent: 'flex-start' },
  userBubble: {
    background: '#6366f1',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '12px 12px 2px 12px',
    maxWidth: '80%',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  botBubble: {
    background: '#2d2d44',
    color: '#e2e8f0',
    padding: '8px 12px',
    borderRadius: '12px 12px 12px 2px',
    maxWidth: '85%',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  dots: {
    animation: 'pulse 1.2s infinite',
    letterSpacing: '2px',
    color: '#8b8fa8',
  },
  inputRow: {
    display: 'flex',
    padding: '8px',
    gap: '6px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: '#16162a',
  },
  textarea: {
    flex: 1,
    background: '#2d2d44',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e2e8f0',
    padding: '8px 10px',
    fontSize: '13px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: '1.4',
  },
  sendBtn: {
    background: '#6366f1',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    width: '36px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

