/**
 * Voice input for trip purpose/notes (e.g. "Log as business – client meeting").
 */

import { useState, useCallback } from 'react'

interface ISpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

const PURPOSE_KEYWORDS: Record<string, string> = {
  business: 'business',
  personal: 'personal',
  medical: 'medical',
  charity: 'charity',
}

export function useVoiceInput(onResult: (purpose: string, notes: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(() => {
    const Win = window as unknown as { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition }
    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition not supported')
      return
    }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    setError(null)
    setListening(true)
    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const transcript = (e.results[0]?.[0]?.transcript ?? '').trim().toLowerCase()
      let purpose = 'business'
      let notes = transcript
      for (const [key, word] of Object.entries(PURPOSE_KEYWORDS)) {
        if (transcript.includes(word)) {
          purpose = key
          notes = transcript.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').replace(/^[\s–-]+|[\s–-]+$/g, '').trim()
          break
        }
      }
      onResult(purpose, notes)
      setListening(false)
    }
    rec.onerror = () => {
      setError('Voice input failed')
      setListening(false)
    }
    rec.onend = () => setListening(false)
    rec.start()
  }, [onResult])

  return { start, listening, error }
}
