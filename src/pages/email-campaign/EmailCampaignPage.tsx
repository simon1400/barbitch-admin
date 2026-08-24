import { useState, useEffect } from 'react'
import { sendCampaign, skippedSummary } from '../../lib/campaignApi'
import { hintCls, kickerCls, pageShellCls } from '../../ui/kit'

// Example emails list for bulk
const exampleBulkEmails = `example1@email.com
example2@email.com
example3@email.com`

interface EmailRecipient {
  email: string
  variables?: Record<string, string>
}

type CampaignMode = 'personalized' | 'bulk'

interface TemplateConfig {
  name: string
  title: string
  subject: string
  variables: string[]
  exampleJson: string
}

const templates: Record<string, TemplateConfig> = {
  'birthday-discount': {
    name: 'Narozeninová sleva',
    title: 'Slavíme 1 rok - Vaše exkluzivní sleva 30%!',
    subject: 'Slavíme 1 rok - Vaše exkluzivní sleva 30%!',
    variables: ['name', 'discount', 'validUntil'],
    exampleJson: JSON.stringify([
      {
        "email": "example1@email.com",
        "variables": {
          "name": "Jana",
        }
      },
      {
        "email": "example2@email.com",
        "variables": {
          "name": "Petra",
        }
      }
    ], null, 2)
  },
}

const EmailCampaignPage = () => {
  const [mode, setMode] = useState<CampaignMode>('personalized')
  const [template, setTemplate] = useState('birthday-discount')
  const [subject, setSubject] = useState(templates['birthday-discount'].subject)
  const [recipientsJson, setRecipientsJson] = useState('')
  const [bulkEmails, setBulkEmails] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null)

  // Update subject when template changes
  useEffect(() => {
    setSubject(templates[template].subject)
  }, [template])

  const currentTemplate = templates[template]

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      let recipients: EmailRecipient[] = []

      if (mode === 'personalized') {
        // Parse JSON for personalized emails
        try {
          recipients = JSON.parse(recipientsJson)
          if (!Array.isArray(recipients)) {
            throw new Error('JSON must be an array')
          }
        } catch (error) {
          console.error(error)
          setMessage({ type: 'error', text: 'Neplatný JSON formát' })
          setLoading(false)
          return
        }
      } else {
        // Parse email list for bulk emails
        const emails = bulkEmails.split('\n').map(e => e.trim()).filter(e => e)
        if (emails.length === 0) {
          setMessage({ type: 'error', text: 'Zadejte alespoň jeden email' })
          setLoading(false)
          return
        }
        recipients = emails.map(email => ({ email }))
      }

      // Отправка через Strapi: там проверяются права владельца и отсеиваются
      // отписавшиеся (NEZASÍLAT), заблокированные и битые адреса (s175).
      const data = await sendCampaign(template, subject, recipients, 'manual')

      const skipTotal =
        data.skipped.optOut +
        data.skipped.blacklisted +
        data.skipped.noConsent +
        data.skipped.invalid +
        data.skipped.duplicate
      const parts: string[] = []
      if (data.failed > 0) parts.push(`Selhalo: ${data.failed}`)
      if (skipTotal > 0) parts.push(`Vynecháno ${skipTotal} — ${skippedSummary(data.skipped)}`)

      setMessage({
        type: 'success',
        text: `Úspěšně odesláno ${data.successful} z ${data.total} emailů`,
        details: parts.length ? parts.join(' · ') : undefined,
      })
      // Clear form
      if (mode === 'personalized') {
        setRecipientsJson('')
      } else {
        setBulkEmails('')
      }
    } catch (error) {
      console.error('Error sending emails:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Chyba při odesílání emailů',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellCls}>
        <div>
          <div className={kickerCls}>Barbitch Admin</div>
          <h1 className="m-0 mb-1.5 text-[24px] leading-[1.2] font-extrabold text-ink">
            Email kampaň
          </h1>
          <p className={`m-0 mb-[18px] ${hintCls}`}>
            Odeslat marketingové emaily zákazníkům s personalizací nebo hromadně
          </p>

          <div className="bg-white border border-line rounded-xl shadow-panel px-6 py-[22px] max-w-4xl">
            <form onSubmit={handleSendEmails} className="space-y-6">
              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-semibold text-ink-body mb-3">
                  Režim odeslání
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="personalized"
                      checked={mode === 'personalized'}
                      onChange={(e) => setMode(e.target.value as CampaignMode)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-ink-body">Personalizované emaily (s proměnnými)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="bulk"
                      checked={mode === 'bulk'}
                      onChange={(e) => setMode(e.target.value as CampaignMode)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-ink-body">Hromadné (bez personalizace)</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-line pt-6"></div>

              {/* Template Selection */}
              <div>
                <label htmlFor="template" className="block text-sm font-semibold text-ink-body mb-2">
                  Email šablona <span className="text-neg">*</span>
                </label>
                <select
                  id="template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-line-btn rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                >
                  {Object.entries(templates).map(([key, config]) => (
                    <option key={key} value={key}>{config.name}</option>
                  ))}
                </select>
                <p className="text-sm text-ink-soft mt-1">
                  Vyberte email šablonu pro kampaň
                </p>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-ink-body mb-2">
                  Předmět emailu <span className="text-neg">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-line-btn rounded-lg text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder="Všechno nejlepší k narozeninám!"
                />
                <p className="text-sm text-ink-soft mt-1">
                  Automaticky vyplněno ze šablony, můžete upravit
                </p>
              </div>

              {/* Recipients - Personalized Mode */}
              {mode === 'personalized' && (
                <div>
                  <label htmlFor="recipientsJson" className="block text-sm font-semibold text-ink-body mb-2">
                    Příjemci (JSON) <span className="text-neg">*</span>
                  </label>
                  <textarea
                    id="recipientsJson"
                    value={recipientsJson}
                    onChange={(e) => setRecipientsJson(e.target.value)}
                    required
                    rows={12}
                    className="w-full px-4 py-3 border border-line-btn rounded-lg text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder={currentTemplate.exampleJson}
                  />
                  <details className="mt-2">
                    <summary className="text-sm text-ink-muted cursor-pointer hover:text-ink">
                      Zobrazit příklad JSON formátu
                    </summary>
                    <pre className="mt-2 p-3 bg-line-soft rounded text-xs overflow-x-auto">
{currentTemplate.exampleJson}
                    </pre>
                  </details>
                  <p className="text-sm text-ink-soft mt-2">
                    Pro šablonu "{currentTemplate.name}" používejte proměnné: <strong>{currentTemplate.variables.join(', ')}</strong>
                  </p>
                </div>
              )}

              {/* Recipients - Bulk Mode */}
              {mode === 'bulk' && (
                <div>
                  <label htmlFor="bulkEmails" className="block text-sm font-semibold text-ink-body mb-2">
                    Email adresy (jeden na řádek) <span className="text-neg">*</span>
                  </label>
                  <textarea
                    id="bulkEmails"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    required
                    rows={10}
                    className="w-full px-4 py-3 border border-line-btn rounded-lg text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder={exampleBulkEmails}
                  />
                  <p className="text-sm text-ink-soft mt-1">
                    Zadejte email adresy, každá na nový řádek
                  </p>
                </div>
              )}

              {/* Message */}
              {message && (
                <div
                  className={`p-4 rounded-lg border ${
                    message.type === 'success'
                      ? 'bg-pos-bg border-pos-line text-green-800'
                      : 'bg-neg-bg border-neg-line text-red-800'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{message.text}</span>
                    {message.details && (
                      <span className="text-sm mt-1">{message.details}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-brand text-white font-semibold rounded-lg hover:bg-brand-press transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? 'Odesílání...' : 'Odeslat kampaň'}
                </button>

                <a
                  href="/global"
                  className="px-8 py-3 bg-gray-200 text-ink-body font-semibold rounded-lg hover:bg-gray-300 transition-colors shadow-md"
                >
                  Zrušit
                </a>
              </div>
            </form>
          </div>
        </div>
    </div>
  )
}

export default EmailCampaignPage
