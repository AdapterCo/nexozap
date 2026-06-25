'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface EvaluationModalProps {
  appointmentId: string
  accessToken: string
  onClose: () => void
}

export function EvaluationModal({ appointmentId, accessToken, onClose }: EvaluationModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) return
    try {
      setSubmitting(true)
      await api.post('/clients/evaluate', {
        appointmentId,
        accessToken,
        rating,
        comment: comment.trim() || undefined,
      })
      setSubmitted(true)
      setTimeout(onClose, 2000)
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Como foi sua experiência?
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Star className="h-6 w-6 text-green-600 fill-green-600" />
            </div>
            <p className="text-lg font-medium text-gray-900">Obrigado pela avaliação!</p>
            <p className="mt-1 text-sm text-gray-500">
              Sua opinião nos ajuda a melhorar.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 py-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-10 w-10 transition-colors',
                      (hoveredStar || rating) >= star
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>

            {rating > 0 && (
              <p className="mb-4 text-center text-sm text-gray-500">
                {rating <= 2
                  ? 'Sentimos muito por sua experiência.'
                  : rating <= 3
                    ? 'Obrigado pelo seu feedback!'
                    : 'Que ótimo! Ficamos felizes!'}
              </p>
            )}

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Comentário (opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte-nos mais sobre sua experiência..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Pular
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className={cn(
                  'flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors',
                  (rating === 0 || submitting) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
