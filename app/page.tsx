'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MessageCircle, X, Minus, Send, Loader2 } from 'lucide-react'
import { callAIAgent } from '@/lib/aiAgent'
import type { NormalizedAgentResponse } from '@/lib/aiAgent'
import { cn } from '@/lib/utils'

// Agent ID from the requirements
const AGENT_ID = "69725d281d92f5e2dd22f8e4"

// TypeScript interfaces based on actual test response
interface AgentResult {
  answer: string
  sources: string[]
  confidence: number
  follow_up_suggestions: string[]
  requires_human: boolean
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  followUpSuggestions?: string[]
  confidence?: number
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-4 py-2">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}

// Bot avatar component
function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
      <MessageCircle className="w-5 h-5 text-white" />
    </div>
  )
}

// User message bubble
function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[75%]">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 shadow-md">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">{message.timestamp}</p>
      </div>
    </div>
  )
}

// Agent message bubble
function AgentMessage({ message }: { message: Message }) {
  return (
    <div className="flex mb-4">
      <div className="mr-2 mt-1">
        <BotAvatar />
      </div>
      <div className="max-w-[75%]">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
          {message.confidence !== undefined && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">Confidence: {(message.confidence * 100).toFixed(0)}%</p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">{message.timestamp}</p>
      </div>
    </div>
  )
}

// Follow-up suggestions component
function FollowUpSuggestions({ suggestions, onSelect }: { suggestions: string[], onSelect: (suggestion: string) => void }) {
  if (suggestions.length === 0) return null

  return (
    <div className="px-4 pb-3 space-y-2">
      <p className="text-xs text-gray-500 font-medium">Suggested questions:</p>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="w-full text-left px-3 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}

export default function Home() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const formatTimestamp = () => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim()
    if (!textToSend || loading) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: formatTimestamp()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setFollowUpSuggestions([])

    try {
      // Call the agent using callAIAgent utility
      const result = await callAIAgent(textToSend, AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const agentData = result.response.result as AgentResult

        // Add agent response message
        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: agentData.answer,
          timestamp: formatTimestamp(),
          followUpSuggestions: agentData.follow_up_suggestions,
          confidence: agentData.confidence
        }

        setMessages(prev => [...prev, agentMessage])
        setFollowUpSuggestions(agentData.follow_up_suggestions || [])
      } else {
        // Error handling
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: result.response.message || 'Sorry, I encountered an error. Please try again.',
          timestamp: formatTimestamp()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'Sorry, I encountered a network error. Please try again.',
        timestamp: formatTimestamp()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setFollowUpSuggestions([])
    handleSendMessage(suggestion)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Floating Chat Button (Collapsed State) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
          aria-label="Open chat"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat Window (Expanded State) */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-6 right-6 w-[400px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-200",
            isMinimized ? "h-[60px]" : "h-[600px]"
          )}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BotAvatar />
              <div>
                <h3 className="text-white font-semibold text-sm">Support</h3>
                <p className="text-blue-100 text-xs">We're here to help</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-blue-700 h-8 w-8"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false)
                  setIsMinimized(false)
                }}
                className="text-white hover:bg-blue-700 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content (hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <BotAvatar />
                    <h4 className="text-gray-800 font-semibold mt-3 mb-1">Welcome to Support</h4>
                    <p className="text-gray-500 text-sm">How can we help you today?</p>
                  </div>
                )}

                {messages.map((message) => (
                  message.role === 'user' ? (
                    <UserMessage key={message.id} message={message} />
                  ) : (
                    <AgentMessage key={message.id} message={message} />
                  )
                ))}

                {loading && (
                  <div className="flex mb-4">
                    <div className="mr-2 mt-1">
                      <BotAvatar />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
                      <TypingIndicator />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Follow-up Suggestions */}
              {followUpSuggestions.length > 0 && !loading && (
                <div className="border-t border-gray-200 bg-white">
                  <FollowUpSuggestions
                    suggestions={followUpSuggestions}
                    onSelect={handleSuggestionClick}
                  />
                </div>
              )}

              {/* Input Section */}
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="flex items-center space-x-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={loading}
                    className="flex-1 bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || loading}
                    className="bg-blue-600 hover:bg-blue-700 h-10 px-4"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
