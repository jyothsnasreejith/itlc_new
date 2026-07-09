import { useSearchParams } from 'react-router-dom'

export default function SubmissionThanks() {
  const [searchParams] = useSearchParams()

  const type = searchParams.get('type')
  const action = searchParams.get('action')

  const isEvent = type === 'event'
  const title = isEvent ? 'Thanks for your response!' : 'Thanks for your request!'
  const message = isEvent
    ? action === 'reject'
      ? 'Your event response has been recorded. We appreciate your quick update.'
      : 'Your event registration has been recorded successfully.'
    : 'Your membership request has been submitted successfully. Our team will review it and reach out soon.'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-3xl">check_circle</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">{title}</h1>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-8">{message}</p>

      </div>
    </div>
  )
}
